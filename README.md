# Tiny Game Interpreter

Tiny Game Interpreter is a dependency-free Node.js project for writing and
running small interactive stories. It uses ES modules and Node's built-in test
runner.

## Setup and use

Install a current Node.js release (Node 18 or newer is recommended). There are
no third-party packages to install.

Run the example story:

```sh
node index.js examples/story.tgs
```

For a longer, presentation-ready story with several routes and endings, run:

```sh
node index.js examples/the-last-beacon.tgs
```

The equivalent npm command is:

```sh
npm start -- examples/story.tgs
```

Run the test suite with:

```sh
npm test
```

## Language

A file contains zero or more named scenes. Execution starts at the first scene
declared in the file.

```tgs
SCENE entrance {
    SAY "You enter a dark room"
    SET hasKey = true

    IF hasKey {
        SAY "The door opens"
        GOTO hallway
    }

    CHOICE {
        "Open the chest" -> treasureRoom
        "Leave the room" -> END
    }
}

SCENE hallway {
    SAY "You entered the hallway"
}

SCENE treasureRoom {
    SAY "You found treasure"
}
```

Supported statements are:

- `SAY "text"` prints one line.
- `SET name = value` stores a string, whole number, `true`, or `false`.
- `IF name { ... }` runs its nested body only when `name` is exactly Boolean
  `true`. `IF` blocks may be nested.
- `GOTO sceneName` immediately moves to another scene.
- `CHOICE { "option" -> sceneName }` displays one or more numbered options and
  waits until the player enters a valid number.
- `END` can replace a scene name in `GOTO` or a choice destination to stop the
  story.

Keywords are case-sensitive. The language has no semicolons, multiline
strings, or decimal numbers. Identifiers begin with a letter or underscore and
may then contain letters, digits, or underscores.

## Architecture

The implementation is a four-stage pipeline:

1. The lexer reads characters and emits positioned tokens. Its explicit
   character classification and stateful scanning are DFA-inspired, but it is
   not presented as a formal DFA.
2. The recursive-descent parser applies the language's context-free grammar
   and builds an AST. JavaScript's call stack provides stack behavior similar
   to a pushdown automaton when parsing nested `IF` blocks, but the parser is
   not a formal PDA implementation.
3. The semantic validator checks facts that syntax alone cannot establish,
   such as unique scenes, defined variables, and valid destinations.
4. The interpreter walks the AST. A scene loop performs state transitions and
   a `Map` supplies mutable variable memory. That combination is inspired by
   the state-and-memory view of a Turing machine; this small interpreter is not
   itself a formal Turing machine.

The AST keeps source structure explicit: a `Program` owns `Scene` nodes, and
each scene owns statement nodes such as `SayStatement`, `SetStatement`,
`IfStatement`, `GotoStatement`, and `ChoiceStatement`.

For a detailed, presentation-focused discussion of DFAs, CFGs, PDA behavior,
ambiguity, semantic analysis, Turing-machine inspiration, limitations, and the
Chomsky hierarchy, see [Models of Computation](MODELS_OF_COMPUTATION.md).
