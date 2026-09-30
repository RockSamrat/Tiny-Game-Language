import test from "node:test";
import assert from "node:assert/strict";
import { Lexer } from "../src/lexer.js";
import { TokenType } from "../src/tokenTypes.js";

test("lexer scans a complete scene", () => {
  const source = `SCENE hallway {
    SAY "Hello"
    SET score = 25
    SET hasKey = true
    GOTO ending
}`;

  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();

  const actualTypes = tokens.map((token) => token.type);

  const expectedTypes = [
    TokenType.SCENE,
    TokenType.IDENTIFIER,
    TokenType.LEFT_BRACE,
    TokenType.SAY,
    TokenType.STRING,
    TokenType.SET,
    TokenType.IDENTIFIER,
    TokenType.EQUAL,
    TokenType.NUMBER,
    TokenType.SET,
    TokenType.IDENTIFIER,
    TokenType.EQUAL,
    TokenType.TRUE,
    TokenType.GOTO,
    TokenType.IDENTIFIER,
    TokenType.RIGHT_BRACE,
    TokenType.EOF,
  ];

  assert.deepEqual(actualTypes, expectedTypes);

  assert.equal(tokens[1].lexeme, "hallway");
  assert.equal(tokens[4].literal, "Hello");
  assert.equal(tokens[8].literal, 25);
  assert.equal(tokens[12].literal, true);
});

test("lexer recognizes symbols and arrow", () => {
  const lexer = new Lexer("{} -> =");
  const tokens = lexer.scanTokens();

  const actualTypes = tokens.map((token) => token.type);

  assert.deepEqual(actualTypes, [
    TokenType.LEFT_BRACE,
    TokenType.RIGHT_BRACE,
    TokenType.ARROW,
    TokenType.EQUAL,
    TokenType.EOF,
  ]);

  assert.equal(tokens[0].lexeme, "{");
  assert.equal(tokens[1].lexeme, "}");
  assert.equal(tokens[2].lexeme, "->");
  assert.equal(tokens[3].lexeme, "=");
});

test("lexer recognizes Boolean values", () => {
  const lexer = new Lexer("true false");
  const tokens = lexer.scanTokens();

  assert.deepEqual(
    tokens.map((token) => token.type),
    [
      TokenType.TRUE,
      TokenType.FALSE,
      TokenType.EOF,
    ],
  );

  assert.equal(tokens[0].literal, true);
  assert.equal(tokens[1].literal, false);
});

test("lexer records line and column positions", () => {
  const source = `{
  =
}`;

  const lexer = new Lexer(source);
  const tokens = lexer.scanTokens();

  assert.equal(tokens[0].type, TokenType.LEFT_BRACE);
  assert.equal(tokens[0].line, 1);
  assert.equal(tokens[0].column, 1);

  assert.equal(tokens[1].type, TokenType.EQUAL);
  assert.equal(tokens[1].line, 2);
  assert.equal(tokens[1].column, 3);

  assert.equal(tokens[2].type, TokenType.RIGHT_BRACE);
  assert.equal(tokens[2].line, 3);
  assert.equal(tokens[2].column, 1);
});

test("empty source produces only EOF", () => {
  const lexer = new Lexer("");
  const tokens = lexer.scanTokens();

  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, TokenType.EOF);
  assert.equal(tokens[0].lexeme, "");
  assert.equal(tokens[0].literal, null);
  assert.equal(tokens[0].line, 1);
  assert.equal(tokens[0].column, 1);
});

test("lexer recognizes every keyword and keeps keywords case-sensitive", () => {
  const tokens = new Lexer(
    "SCENE SAY SET IF GOTO CHOICE true false scene TRUE",
  ).scanTokens();

  assert.deepEqual(tokens.map((token) => token.type), [
    TokenType.SCENE,
    TokenType.SAY,
    TokenType.SET,
    TokenType.IF,
    TokenType.GOTO,
    TokenType.CHOICE,
    TokenType.TRUE,
    TokenType.FALSE,
    TokenType.IDENTIFIER,
    TokenType.IDENTIFIER,
    TokenType.EOF,
  ]);
});

test("lexer stores string, whole-number, and Boolean literal values", () => {
  const tokens = new Lexer('"hello" 123 true false').scanTokens();

  assert.deepEqual(
    tokens.slice(0, -1).map((token) => token.literal),
    ["hello", 123, true, false],
  );
});

test("lexer tracks positions across CRLF lines", () => {
  const tokens = new Lexer("SCENE first {\r\n\tSAY \"Hi\"\r\n}").scanTokens();
  const say = tokens.find((token) => token.type === TokenType.SAY);
  const string = tokens.find((token) => token.type === TokenType.STRING);
  const eof = tokens.at(-1);

  assert.deepEqual(
    { line: say.line, column: say.column },
    { line: 2, column: 2 },
  );
  assert.deepEqual(
    { line: string.line, column: string.column },
    { line: 2, column: 6 },
  );
  assert.deepEqual(
    { line: eof.line, column: eof.column },
    { line: 3, column: 2 },
  );
});

test("lexer rejects unknown characters with their position", () => {
  assert.throws(
    () => new Lexer("\n  @").scanTokens(),
    /Lexical error at line 2, column 3: Unexpected character "@"/,
  );
});

test("lexer rejects a lone hyphen instead of treating it as an arrow", () => {
  assert.throws(
    () => new Lexer("-").scanTokens(),
    /Unexpected character "-"/,
  );
});

test("lexer rejects unterminated strings", () => {
  assert.throws(
    () => new Lexer('SAY "unfinished').scanTokens(),
    /Unterminated string/,
  );
});

test("lexer rejects multiline strings", () => {
  assert.throws(
    () => new Lexer('SAY "first\nsecond"').scanTokens(),
    /Multiline strings are not allowed/,
  );
});
