import test from "node:test";
import assert from "node:assert/strict";

import { Interpreter } from "../src/interpreter.js";
import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { Validator } from "../src/semanticValidator.js";

function parseAndValidate(source) {
  const ast = new Parser(new Lexer(source).scanTokens()).parse();
  new Validator(ast).validate();
  return ast;
}

async function runStory(source, answers = []) {
  const output = [];
  const prompts = [];
  const remainingAnswers = [...answers];
  const interpreter = new Interpreter(parseAndValidate(source), {
    output: (line) => output.push(line),
    question: async (prompt) => {
      prompts.push(prompt);
      return remainingAnswers.shift();
    },
  });

  await interpreter.run();
  return { interpreter, output, prompts };
}

test("interpreter executes SAY", async () => {
  const result = await runStory('SCENE start { SAY "Hello" }');
  assert.deepEqual(result.output, ["Hello"]);
});

test("interpreter stores SET values in its variables Map", async () => {
  const { interpreter } = await runStory(`
    SCENE start {
      SET name = "Ada"
      SET score = 12
      SET ready = true
    }
  `);

  assert.ok(interpreter.variables instanceof Map);
  assert.deepEqual(
    Object.fromEntries(interpreter.variables),
    { name: "Ada", score: 12, ready: true },
  );
});

test("interpreter executes IF only for the Boolean value true", async () => {
  const result = await runStory(`
    SCENE start {
      SET yes = true
      SET no = false
      SET one = 1
      IF yes { SAY "yes" }
      IF no { SAY "no" }
      IF one { SAY "one" }
    }
  `);

  assert.deepEqual(result.output, ["yes"]);
});

test("interpreter executes nested IF blocks", async () => {
  const result = await runStory(`
    SCENE start {
      SET outer = true
      SET inner = true
      IF outer {
        IF inner { SAY "nested" }
      }
    }
  `);

  assert.deepEqual(result.output, ["nested"]);
});

test("interpreter follows a direct GOTO", async () => {
  const result = await runStory(`
    SCENE start { GOTO second }
    SCENE second { SAY "arrived" }
  `);

  assert.deepEqual(result.output, ["arrived"]);
});

test("interpreter propagates GOTO out of nested IF blocks", async () => {
  const result = await runStory(`
    SCENE start {
      SET outer = true
      SET inner = true
      IF outer {
        IF inner { GOTO second }
        SAY "skipped inner"
      }
      SAY "skipped scene"
    }
    SCENE second { SAY "arrived" }
  `);

  assert.deepEqual(result.output, ["arrived"]);
});

test("interpreter skips statements after GOTO in the old scene", async () => {
  const result = await runStory(`
    SCENE start {
      SAY "before"
      GOTO second
      SAY "after"
    }
    SCENE second { SAY "second" }
  `);

  assert.deepEqual(result.output, ["before", "second"]);
});

test("interpreter displays and follows a selected CHOICE", async () => {
  const result = await runStory(`
    SCENE start {
      CHOICE {
        "Left" -> left
        "Right" -> right
      }
    }
    SCENE left { SAY "left room" }
    SCENE right { SAY "right room" }
  `, ["2"]);

  assert.deepEqual(result.output, ["1. Left", "2. Right", "right room"]);
  assert.deepEqual(result.prompts, ["Choose an option: "]);
});

test("interpreter asks again after invalid CHOICE input", async () => {
  const result = await runStory(`
    SCENE start {
      CHOICE {
        "Continue" -> next
        "Stop" -> END
      }
    }
    SCENE next { SAY "continued" }
  `, ["not a number", "0", "3", "1"]);

  assert.deepEqual(result.output, [
    "1. Continue",
    "2. Stop",
    "Please enter a number from 1 to 2.",
    "Please enter a number from 1 to 2.",
    "Please enter a number from 1 to 2.",
    "continued",
  ]);
  assert.equal(result.prompts.length, 4);
});

test("interpreter stops immediately at END", async () => {
  const result = await runStory(`
    SCENE start {
      SAY "before"
      GOTO END
      SAY "after"
    }
  `);

  assert.deepEqual(result.output, ["before"]);
  assert.equal(result.interpreter.currentScene, null);
});

test("interpreter handles END selected from a CHOICE", async () => {
  const result = await runStory(`
    SCENE start {
      CHOICE { "Finish" -> END }
      SAY "after"
    }
  `, ["1"]);

  assert.deepEqual(result.output, ["1. Finish"]);
});

test("interpreter rejects an empty program", async () => {
  const interpreter = new Interpreter(parseAndValidate(""), {
    output: () => {},
  });

  await assert.rejects(interpreter.run(), /Program contains no scenes/);
});

test("interpreter closes an open readline interface after an error", async () => {
  const ast = {
    type: "Program",
    scenes: [{ type: "Scene", name: "start", statements: [
      { type: "UnexpectedStatement" },
    ] }],
  };
  const interpreter = new Interpreter(ast, { output: () => {} });
  let closed = false;
  interpreter.readline = { close: () => { closed = true; } };

  await assert.rejects(interpreter.run(), /Unknown statement type/);
  assert.equal(closed, true);
});
