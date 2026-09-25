import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";

const source = `
SCENE hallway {
    SAY "Hello"
    SET score = 25
    SET hasKey = true
}
`;

const lexer = new Lexer(source);
const tokens = lexer.scanTokens();

const parser = new Parser(tokens);
const ast = parser.parse();

console.dir(ast, { depth: null });