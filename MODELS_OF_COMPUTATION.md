# Models of Computation in the Tiny Game Interpreter

This document explains how ideas from automata theory and models of computation
appear in the Tiny Game Interpreter. It is intended as presentation material
for a Models of Computation course.

The most important qualification is this:

> The project is inspired by DFAs, PDAs, and Turing machines, but its JavaScript
> classes are not formal implementations of those mathematical machines.

Each model contributes the idea best suited to one stage of the language:

| Project stage | Main theoretical idea | What it contributes |
| --- | --- | --- |
| Lexer | Regular languages and DFA-style state transitions | Recognizes local token patterns |
| Parser | Context-free grammar and PDA-style stack behavior | Recognizes nested program structure |
| AST | Syntax tree representation | Preserves the recognized structure |
| Semantic validator | Symbol tables and multi-pass analysis | Checks non-local relationships |
| Interpreter | State transitions and mutable memory | Executes the program and handles input/output |

This separation is useful because the weakest adequate model is used at each
stage. A more powerful model is not automatically faster, clearer, or better.

## 1. Complete architecture

The program follows this pipeline:

```text
Story source
    |
    v
Lexer ---------> positioned tokens
    |
    v
Parser --------> abstract syntax tree (AST)
    |
    v
Semantic validator
    |
    v
Interpreter ---> output, choices, state changes, scene transitions
```

For example, this source:

```tgs
SCENE entrance {
    SET hasKey = true
    IF hasKey {
        SAY "The door opens"
        GOTO hallway
    }
}
```

passes through the following forms:

1. The lexer produces tokens such as `SCENE`, `IDENTIFIER`, `LEFT_BRACE`,
   `SET`, `TRUE`, and `EOF`.
2. The parser groups those tokens into `Program`, `Scene`, `SetStatement`,
   `IfStatement`, `SayStatement`, and `GotoStatement` nodes.
3. The validator checks that `hasKey` is defined and `hallway` exists.
4. The interpreter stores `hasKey -> true`, enters the `IF`, prints the text,
   and changes the current scene to `hallway`.

## 2. Lexer: regular languages and DFA-inspired scanning

### What a DFA is

A deterministic finite automaton has:

- a finite set of states;
- an input alphabet;
- one transition for each state/input pair;
- one start state;
- one or more accepting states; and
- no stack or unbounded memory.

A DFA recognizes a regular language. Regular languages work well for token
patterns because a token usually depends only on nearby characters.

### Regular token patterns in this project

The lexer recognizes patterns equivalent to the following regular
expressions:

```text
IDENTIFIER  = [A-Za-z_][A-Za-z0-9_]*
NUMBER      = [0-9]+
STRING      = "[^"\r\n]*"
ARROW       = ->
LEFT_BRACE  = {
RIGHT_BRACE = }
EQUAL       = =
WHITESPACE  = spaces, tabs, carriage returns, and newlines
```

After an identifier-shaped word is scanned, exact text determines whether it
is a keyword:

```text
SCENE SAY SET IF GOTO CHOICE true false
```

This rule also makes keywords case-sensitive. `SCENE` is a keyword, while
`scene` is an ordinary identifier. `true` is a Boolean token, while `TRUE` is
an identifier.

`END` deliberately has no separate token type. The lexer emits it as an
`IDENTIFIER`; later stages interpret the exact destination name `END`
specially.

### DFA-style states

The JavaScript lexer does not declare a formal transition function, but its
control flow behaves like repeatedly running small deterministic machines:

| Current state | Input | Action / next state |
| --- | --- | --- |
| Start | Letter or `_` | Enter Identifier |
| Identifier | Letter, digit, or `_` | Stay in Identifier |
| Identifier | Anything else | Accept identifier or keyword |
| Start | Digit | Enter Number |
| Number | Digit | Stay in Number |
| Number | Anything else | Accept whole number |
| Start | `"` | Enter String |
| String | Any character except `"`, `\r`, `\n` | Stay in String |
| String | `"` | Accept string |
| String | Newline or end of input | Reject |
| Start | `-` | Enter Arrow-check state |
| Arrow-check | `>` | Accept `ARROW` |
| Arrow-check | Anything else | Reject |
| Start | `{`, `}`, or `=` | Accept the matching one-character token |
| Start | Unknown character | Reject |

The scanner returns to its start behavior after accepting each token. It also
records line and column positions and converts lexemes into literal values:

```text
"hello" -> JavaScript string "hello"
42      -> JavaScript number 42
true    -> JavaScript Boolean true
false   -> JavaScript Boolean false
```

### Why the lexer is only DFA-inspired

The lexer class has counters, creates token objects, stores a growing token
array, and reports positions. A mathematical DFA only accepts or rejects a
string and has finite internal state. A lexer that emits tokens is more
accurately described as a scanner or finite-state transducer with supporting
program state.

The token recognition logic is regular and DFA-like, but the entire JavaScript
object should not be claimed as a formal DFA.

### Limitation faced by the DFA model

A DFA has no unbounded stack. It cannot generally recognize arbitrarily nested
matching braces such as:

```tgs
IF first {
    IF second {
        IF third {
            SAY "Nested"
        }
    }
}
```

The lexer can emit brace tokens, but it cannot determine the full hierarchical
meaning of those braces using ordinary finite-state recognition. It also
cannot answer questions such as:

- Does a `GOTO` target name an existing scene?
- Is a scene name duplicated?
- Was an `IF` variable defined by any `SET`?
- Does a `SAY` belong to the outer or inner `IF`?

The parser adds stack behavior to solve the nesting problem. The semantic
validator solves the non-local name problems.

## 3. Parser: context-free grammar and PDA-inspired behavior

### Why a CFG is needed

A context-free grammar describes how tokens combine recursively. Recursion is
the important improvement over regular token patterns: a grammar can describe
arbitrary nesting.

The terminals in this grammar are lexer token types. The following BNF-style
rules describe the implemented language:

```text
<program> ::= <scene-list> EOF

<scene-list> ::= <scene> <scene-list>
               | epsilon

<scene> ::= SCENE IDENTIFIER LEFT_BRACE <statements> RIGHT_BRACE

<statements> ::= <statement> <statements>
               | epsilon

<statement> ::= <say-statement>
              | <set-statement>
              | <if-statement>
              | <goto-statement>
              | <choice-statement>

<say-statement> ::= SAY STRING

<set-statement> ::= SET IDENTIFIER EQUAL <value>

<value> ::= STRING
          | NUMBER
          | TRUE
          | FALSE

<if-statement> ::= IF IDENTIFIER LEFT_BRACE <statements> RIGHT_BRACE

<goto-statement> ::= GOTO IDENTIFIER

<choice-statement> ::= CHOICE LEFT_BRACE
                       <choice-option> <choice-option-tail>
                       RIGHT_BRACE

<choice-option-tail> ::= <choice-option> <choice-option-tail>
                       | epsilon

<choice-option> ::= STRING ARROW IDENTIFIER
```

`epsilon` means the empty sequence. The choice rule uses one required
`<choice-option>` followed by an optional tail, which is why an empty `CHOICE`
block is invalid.

There are no newline or semicolon terminals. Whitespace is removed by the
lexer. Statement boundaries remain recognizable because every statement
starts with a distinct keyword and each production has a fixed form.

### Nested `IF` and the parser's call stack

The production for `<if-statement>` contains `<statements>`, and
`<statements>` can contain another `<if-statement>`. This recursive rule is
what permits nesting.

The recursive-descent parser mirrors that structure:

```text
parseIfStatement
    -> parseStatement
        -> parseIfStatement
            -> parseStatement
```

Each JavaScript function call remains on the runtime call stack until its
matching `RIGHT_BRACE` is found. This resembles the stack behavior of a
pushdown automaton:

- entering a nested block behaves like pushing context;
- parsing statements uses the current top context;
- reading the matching `}` behaves like popping context.

A formal PDA would define stack symbols and transition rules explicitly. This
project instead uses JavaScript's call stack, so it is PDA-inspired rather than
a literal PDA implementation.

### Predictive parsing

The grammar is suitable for simple predictive recursive descent. One token of
lookahead is enough for the parser's main decisions:

```text
SAY    -> parse SAY
SET    -> parse SET
IF     -> parse IF
GOTO   -> parse GOTO
CHOICE -> parse CHOICE
```

The alternatives have disjoint starting token sets. In compiler terminology,
the statement portion is LL(1)-like: input is read from left to right, a
leftmost derivation is constructed, and one lookahead token selects an
alternative. This document does not claim a complete formal LL(1) proof, but
the relevant FIRST sets are visibly disjoint.

### Limitation faced by the CFG/PDA model

An ordinary CFG describes local syntactic shape, not arbitrary relationships
between distant identifiers. The grammar can confirm that `GOTO` is followed
by an identifier, but it cannot conveniently confirm that a scene with that
same spelling exists elsewhere.

For the same reason, parsing alone does not enforce:

- unique scene names;
- valid `GOTO` targets;
- valid `CHOICE` targets; or
- the existence of a `SET` for each `IF` variable.

These are commonly called context-sensitive or non-local semantic
constraints. A compiler normally handles them with symbol tables and semantic
passes rather than trying to make the CFG enormous.

The parser also does not execute anything. It knows that a `GOTO` has valid
syntax, but it does not change scenes or store variables.

## 4. Ambiguity

### What ambiguity means

A context-free grammar is ambiguous if at least one valid token sequence has
two different parse trees, or equivalently two different leftmost or rightmost
derivations.

Ambiguity matters because the program could then have two structural meanings.
For an interpreter, those meanings could produce different behavior.

### Why this project's grammar avoids common ambiguity

The implemented grammar is designed to have a clear parse:

1. Every statement alternative begins with a different keyword.
2. Braces explicitly mark the start and end of scene, `IF`, and `CHOICE`
   bodies.
3. Every choice option has the fixed form `STRING ARROW IDENTIFIER`.
4. Each value token has a distinct token type.
5. There is no `ELSE`, so the classic dangling-`else` ambiguity cannot occur.
6. Keywords are separated from identifiers during lexing.

For example:

```tgs
IF hasKey {
    IF doorOpen {
        SAY "Open"
    }
}
```

The braces make it clear which statements belong to which `IF`.

### A hypothetical ambiguous design

If braces were removed and `ELSE` were added, this source could become
ambiguous:

```text
IF first
    IF second
        SAY "yes"
    ELSE
        SAY "no"
```

The `ELSE` could belong to either the inner or outer `IF`. Many languages solve
this by a grammar rule that attaches `ELSE` to the nearest unmatched `IF`, or
by requiring explicit delimiters. This project avoids the problem by requiring
braces and not implementing `ELSE`.

### Lexical ambiguity versus grammatical ambiguity

There can also be overlapping token patterns. For example, `SCENE` matches the
general identifier pattern as well as a keyword. The lexer resolves this
deterministically:

1. scan the entire identifier-shaped word;
2. compare it with the keyword table; and
3. emit a keyword token only for an exact match.

Similarly, `-` is not accepted independently. It must be immediately followed
by `>` to form one `ARROW` token.

`END` demonstrates contextual meaning rather than parse ambiguity. It is
always lexed and parsed as an identifier-shaped destination. The validator and
interpreter consistently give the exact target `END` its special halting
meaning.

### Is the grammar formally proven unambiguous?

No formal proof is included in the project. However, the distinct statement
prefixes, fixed productions, and explicit braces make the intended parse
deterministic in the implemented recursive-descent parser. A careful
presentation should say that the grammar is *designed to be unambiguous*, not
that a complete mathematical proof has been provided.

## 5. The AST: the bridge between recognition and execution

An abstract syntax tree is not itself a model of computation. It is a data
structure that preserves the parser's chosen hierarchical interpretation.

The important node shapes are:

```text
Program
  scenes: Scene[]

Scene
  name: string
  statements: Statement[]

SayStatement
  text: string

SetStatement
  name: string
  value: string | number | Boolean

IfStatement
  condition: string
  statements: Statement[]

GotoStatement
  target: string

ChoiceStatement
  options: { text, target }[]
```

Concrete punctuation such as braces and arrows is no longer needed after it
has established the tree structure. This is why the tree is *abstract* rather
than a complete concrete syntax tree.

The AST separates two concerns:

- the parser decides what the source structurally means;
- the interpreter decides what that structure does at runtime.

## 6. Semantic validation: handling non-local constraints

The semantic validator performs multiple passes with `Set` objects acting as
symbol tables.

### Pass 1: collect scene names

Every scene name is stored. Encountering the same name twice causes a duplicate
scene error.

### Pass 2: collect variable definitions

Every variable named by `SET` is collected, including definitions inside
nested `IF` blocks.

### Pass 3: validate statements recursively

The validator checks:

- every `GOTO` target exists or equals `END`;
- every choice target exists or equals `END`;
- every `IF` condition has a variable name collected from some `SET`; and
- nested `IF` statements are checked recursively.

### Why this is separate from the CFG

The token sequence can be perfectly grammatical while still being
meaningless:

```tgs
SCENE start {
    GOTO missingScene
}
```

The CFG accepts the form `GOTO IDENTIFIER`. Only a non-local pass can compare
`missingScene` against the complete set of declared scenes.

The project does not implement these checks as a context-sensitive grammar or
a linear bounded automaton. Although the Chomsky hierarchy is useful
theoretically, a symbol table is far simpler and is the standard engineering
solution.

### Semantic limitation in the current project

Variable checking is existence-based and flow-insensitive. It proves that a
variable is written by some `SET` somewhere in the program, not that the `SET`
must execute before every possible `IF` use.

For example, the validator accepts this because `ready` occurs in a `SET`:

```tgs
SCENE start {
    IF ready {
        SAY "Ready"
    }
    SET ready = true
}
```

At runtime, the first condition reads as undefined and therefore is not exactly
Boolean `true`, so the body is skipped. A more advanced implementation could
use control-flow graphs and definite-assignment analysis.

## 7. Interpreter: state transitions and Turing-machine inspiration

### A useful runtime configuration

Interpreter execution can be described with a configuration:

```text
C = (current scene, statement position, nested block context,
     variable memory, pending player input)
```

Each executed statement transforms one configuration into another:

```text
C -> C'
```

Examples:

- `SAY` changes output and advances the statement position.
- `SET` writes a value into variable memory.
- `IF` reads variable memory and either enters or skips a nested block.
- `GOTO` replaces the current scene and stops the old scene immediately.
- `CHOICE` reads input and selects the next scene.
- `END` moves execution into a halting state.

The interpreter uses a loop for scene-to-scene transitions. It does not use
recursive calls for `GOTO`, so a long route does not continually grow the
JavaScript call stack. Recursion is used only for statically nested `IF`
blocks.

### Comparison with a Turing machine

| Turing-machine concept | Project analogue |
| --- | --- |
| Finite control state | Current scene and statement being executed |
| Tape memory | `variables` Map |
| Read operation | Read a variable or player choice |
| Write operation | Execute `SET` |
| Transition | Advance, enter `IF`, `GOTO`, or follow a choice |
| Output convention | Execute `SAY` |
| Halting state | Reach `END` or finish a scene without a transition |

This analogy explains why the interpreter is Turing-machine-inspired: both are
described through state, memory, reads, writes, transitions, and halting.

### Why the interpreter is not a formal Turing machine

The implementation relies on JavaScript, Node.js `Map`, arrays, promises,
terminal input, and the host computer's memory. It does not define a tape
alphabet, an infinite tape, or a mathematical transition function.

The `Map` is only analogous to tape memory. It stores named variables rather
than symbols in adjacent tape cells.

### Is the story language Turing-complete?

No. The current story language should not be presented as Turing-complete.

For any fixed story:

- the number of scenes and statements is finite;
- the set of variable names is finite;
- variables can only receive literal values written in the finite source;
- there is no arithmetic;
- there is no way to create new variables dynamically;
- there is no unbounded list, stack, or tape available to story code; and
- `IF` only tests whether a named value is exactly Boolean `true`.

Ignoring the history of printed output and treating invalid choice inputs as
equivalent retries, a fixed story has a finite collection of meaningful
runtime configurations. The language is therefore closer to a finite-state
transition system with finite mutable memory than to a universal Turing
machine.

It can still run forever:

```tgs
SCENE loop {
    GOTO loop
}
```

Nontermination alone does not imply Turing completeness. A small finite-state
machine can loop forever too.

The JavaScript runtime is capable of general computation, but that does not
automatically give the restricted story language the same expressive power.

### Termination and the halting problem

For general Turing machines, the halting problem is undecidable. It would be
incorrect to use that fact as proof that termination analysis is impossible
for this small language.

Because a fixed story has finite effective state, a future analyzer could
construct a control-flow/state graph and detect reachable cycles. Player
choices would require distinguishing questions such as:

- Can *some* choice sequence loop forever?
- Do *all* choice sequences eventually halt?

The current interpreter does not perform that analysis, so a cyclic story can
run indefinitely.

## 8. How the models improve on one another

The progression is mainly about expressive power:

```text
Finite automaton
    recognizes local regular patterns
        |
        | add a stack
        v
Pushdown automaton / CFG parser
    recognizes recursive and nested structure
        |
        | add symbol tables and whole-program passes
        v
Semantic analysis
    checks declarations and non-local relationships
        |
        | add runtime state, mutable memory, and transitions
        v
Interpreter
    performs the program's behavior
```

The key trade-off is that greater expressiveness brings more implementation
state and more difficult analysis:

| Approach | Strength | Limitation in this project |
| --- | --- | --- |
| DFA-style lexer | Simple, deterministic, linear token recognition | Cannot represent arbitrary nesting or global name relationships |
| CFG/PDA-style parser | Represents recursive nested syntax | Does not naturally enforce declarations or execute behavior |
| Symbol-table validation | Efficiently checks non-local names | Current analysis is flow-insensitive |
| Stateful interpreter | Supports memory, input, output, and transitions | May run forever on cycles; DSL remains intentionally limited |

This is not a competition in which the Turing machine should replace every
other model. Using a general computation model to recognize every brace or
number would hide useful structure. Compiler pipelines deliberately combine
specialized models.

## 9. Relation to the Chomsky hierarchy

The standard hierarchy provides useful context:

| Type | Language family | Recognizer | Relevance here |
| --- | --- | --- | --- |
| Type 3 | Regular | Finite automaton | Token patterns |
| Type 2 | Context-free | Pushdown automaton | Nested syntax and CFG parsing |
| Type 1 | Context-sensitive | Linear bounded automaton | Theoretical home for richer contextual restrictions; not directly implemented |
| Type 0 | Recursively enumerable | Turing machine | General computation model and runtime inspiration |

Under the usual definitions, regular languages are contained in
context-free languages, which are contained in context-sensitive languages,
which are contained in recursively enumerable languages.

The project's stages should not be labeled as exact Chomsky machines merely
because they solve related problems. In particular, semantic validation uses
ordinary algorithms and sets, not an implemented linear bounded automaton.

## 10. Error detection by stage

Each stage reports the errors it is best equipped to understand:

| Error | Detecting stage | Reason |
| --- | --- | --- |
| Unknown character | Lexer | Character belongs to no token pattern |
| Unterminated or multiline string | Lexer | String automaton cannot reach a valid accepting state |
| Missing scene brace | Parser | Token sequence violates the CFG |
| Missing `SET` value | Parser | No `<value>` production matches |
| Empty `CHOICE` | Parser | Grammar requires at least one option |
| Duplicate scene | Semantic validator | Requires comparing declarations |
| Missing destination | Semantic validator | Requires the global scene-name set |
| Undefined `IF` variable | Semantic validator | Requires the global variable-definition set |
| Unexpected AST node | Interpreter | Invalid runtime state reached execution |
| Invalid choice number | Interpreter | Depends on live player input |

This division produces clearer errors and keeps each component focused.

## 11. Complexity

Let `n` be the number of source characters and `t` the number of tokens.

- Lexing is `O(n)` because each source character is examined a constant number
  of times.
- Parsing is `O(t)` for valid input because the predictive parser advances
  through the token stream without backtracking.
- Semantic validation is linear in the number of scenes, statements, and
  options on average; JavaScript `Set` lookup is expected `O(1)`.
- Interpretation is linear in the number of statements actually executed, but
  there is no finite upper bound when the story contains reachable cycles or
  waits for unlimited invalid player inputs.

Memory includes the token list, AST, scene map, variable map, and parser or
interpreter call stack for nested blocks.

## 12. Presentation walkthrough

A clear classroom demonstration can follow these steps:

1. Show a short story source and identify lexemes.
2. Show the token types and explain why token recognition is regular.
3. Point to a nested `IF` and ask why a finite automaton cannot remember
   arbitrary nesting.
4. Present the CFG rules and show how the recursive `IF` production solves
   nesting.
5. Explain that the recursive-descent call stack plays the practical role of a
   PDA stack.
6. Show the corresponding AST hierarchy.
7. Use a missing `GOTO` target to demonstrate a valid parse that fails semantic
   validation.
8. Run `examples/the-last-beacon.tgs` and relate `SET`, `IF`, `GOTO`, and
   `CHOICE` to runtime state transitions.
9. Explain why the runtime is Turing-machine-inspired but the story language
   is not Turing-complete.
10. Finish with the principle that language tools combine several models
    because each model solves a different class of problem cleanly.

## 13. Likely questions and short answers

### Is the lexer a DFA?

Its token-recognition logic is DFA-inspired and recognizes regular patterns,
but the JavaScript class also emits tokens, stores them, and tracks positions.
It is not a formal DFA definition.

### Is the parser a PDA?

It uses recursive-descent functions and JavaScript's call stack in a way that
resembles PDA stack behavior. It is not encoded as a formal PDA transition
system.

### Why can a PDA parse nested `IF` blocks when a DFA cannot?

A PDA has a stack that can remember an unbounded number of unmatched opening
blocks. A DFA has only finitely many states and therefore cannot store an
arbitrary nesting depth.

### Is the grammar ambiguous?

It is designed to be unambiguous: statement alternatives have distinct first
tokens, and braces explicitly delimit nesting. No complete formal ambiguity
proof is included.

### Why is semantic validation not part of parsing?

Parsing verifies grammatical structure. Target existence, duplicate names, and
variable declarations require comparisons with information elsewhere in the
program, so symbol-table passes are clearer.

### Is the interpreter a Turing machine?

No. It is inspired by Turing-machine ideas of state, memory, transitions, and
halting, but it uses ordinary JavaScript structures and has no formal infinite
tape or transition function.

### Is the language Turing-complete?

No. A fixed story has finite control and finite possible stored literal values.
It lacks unbounded programmable memory and operations needed for universal
computation.

### Why can the language still have infinite loops?

A finite-state system can revisit the same state forever. Infinite looping is
not sufficient evidence of Turing completeness.

### What would make the language more powerful?

Arithmetic, variable-to-variable expressions, mutable counters, comparisons,
and unbounded data structures could increase its expressive power. Adding
features also makes parsing, semantic analysis, termination reasoning, and
testing more difficult.

## 14. Final takeaway

The project demonstrates a central lesson of computation theory:

> Different computational models are appropriate for different kinds of
> structure.

Finite-state reasoning handles token patterns. Stack-based context-free
reasoning handles nesting. Symbol tables handle whole-program relationships.
State transitions and mutable memory handle execution. The architecture works
because these ideas cooperate rather than because one model is forced to solve
every problem.
