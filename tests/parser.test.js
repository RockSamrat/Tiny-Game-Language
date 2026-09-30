import test from "node:test";
import assert from "node:assert/strict";

import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";

function parseSource(source) {
  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();

  const parser = new Parser(tokens);
  return parser.parse();
}

test("parser parses multiple empty scenes", () => {
  const ast = parseSource(`
SCENE hallway {}
SCENE ending {}
`);

  assert.equal(ast.type, "Program");
  assert.equal(ast.scenes.length, 2);
  assert.equal(ast.scenes[0].name, "hallway");
  assert.equal(ast.scenes[1].name, "ending");
});

test("parser parses SAY statements", () => {
  const ast = parseSource(`
SCENE hallway {
  SAY "Hello"
  SAY "Welcome!"
}
`);

  assert.deepEqual(ast.scenes[0].statements, [
    {
      type: "SayStatement",
      text: "Hello",
    },
    {
      type: "SayStatement",
      text: "Welcome!",
    },
  ]);
});

test("parser parses SET values", () => {
  const ast = parseSource(`
SCENE setup {
  SET playerName = "Samrat"
  SET score = 25
  SET hasKey = true
  SET doorOpen = false
}
`);

  assert.deepEqual(ast.scenes[0].statements, [
    {
      type: "SetStatement",
      name: "playerName",
      value: "Samrat",
    },
    {
      type: "SetStatement",
      name: "score",
      value: 25,
    },
    {
      type: "SetStatement",
      name: "hasKey",
      value: true,
    },
    {
      type: "SetStatement",
      name: "doorOpen",
      value: false,
    },
  ]);
});

test("parser parses GOTO statements", () => {
  const ast = parseSource(`
SCENE entrance {
  GOTO hallway
}

SCENE hallway {}
`);

  assert.deepEqual(ast.scenes[0].statements[0], {
    type: "GotoStatement",
    target: "hallway",
  });
});

test("parser parses nested IF statements", () => {
  const ast = parseSource(`
SCENE entrance {
  IF hasKey {
    SAY "You have the key."

    IF doorOpen {
      GOTO hallway
    }
  }
}

SCENE hallway {}
`);

  assert.deepEqual(ast.scenes[0].statements[0], {
    type: "IfStatement",
    condition: "hasKey",
    statements: [
      {
        type: "SayStatement",
        text: "You have the key.",
      },
      {
        type: "IfStatement",
        condition: "doorOpen",
        statements: [
          {
            type: "GotoStatement",
            target: "hallway",
          },
        ],
      },
    ],
  });
});

test("parser parses CHOICE with multiple options", () => {
  const ast = parseSource(`
SCENE entrance {
  CHOICE {
    "Open the chest" -> treasureRoom
    "Leave the room" -> hallway
  }
}

SCENE treasureRoom {}
SCENE hallway {}
`);

  assert.deepEqual(ast.scenes[0].statements[0], {
    type: "ChoiceStatement",
    options: [
      {
        text: "Open the chest",
        target: "treasureRoom",
      },
      {
        text: "Leave the room",
        target: "hallway",
      },
    ],
  });
});

test("parser rejects a scene without a name", () => {
  assert.throws(
    () => parseSource(`SCENE {}`),
    /Expected scene name after SCENE/,
  );
});

test("parser rejects a missing closing scene brace", () => {
  assert.throws(
    () =>
      parseSource(`
SCENE hallway {
  SAY "Hello"
`),
    /Expected "}" after scene body/,
  );
});

test("parser rejects an empty CHOICE", () => {
  assert.throws(
    () =>
      parseSource(`
SCENE entrance {
  CHOICE {}
}
`),
    /CHOICE requires at least one option/,
  );
});

test("parser rejects an invalid statement", () => {
  assert.throws(
    () =>
      parseSource(`
SCENE hallway {
  25
}
`),
    /Expected a statement/,
  );
});

test("parser includes line and column in syntax errors", () => {
  assert.throws(
    () => parseSource("\nSCENE { }"),
    /Syntax error at line 2, column 7: Expected scene name/,
  );
});

test("parser rejects a missing opening scene brace", () => {
  assert.throws(
    () => parseSource("SCENE entrance SAY \"Hello\""),
    /Expected "\{" after scene name/,
  );
});

test("parser rejects SET without a variable name", () => {
  assert.throws(
    () => parseSource("SCENE entrance { SET = true }"),
    /Expected variable name after SET/,
  );
});

test("parser rejects SET without a value", () => {
  assert.throws(
    () => parseSource("SCENE entrance { SET ready = }"),
    /Expected a string, whole number, true, or false/,
  );
});

test("parser rejects a missing IF opening brace", () => {
  assert.throws(
    () => parseSource("SCENE entrance { IF ready SAY \"No brace\" }"),
    /Expected "\{" after IF condition/,
  );
});

test("parser rejects CHOICE options without an arrow", () => {
  assert.throws(
    () => parseSource('SCENE entrance { CHOICE { "Go" ending } }'),
    /Expected "->" after choice text/,
  );
});

test("parser rejects CHOICE options without a destination", () => {
  assert.throws(
    () => parseSource('SCENE entrance { CHOICE { "Go" -> } }'),
    /Expected destination scene after "->"/,
  );
});

test("parser parses END as a special destination name", () => {
  const ast = parseSource(`
SCENE entrance {
  CHOICE { "Finish" -> END }
}
`);

  assert.equal(ast.scenes[0].statements[0].options[0].target, "END");
});
