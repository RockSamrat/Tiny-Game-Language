import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";
import { Validator } from "./src/semanticValidator.js";
import { Interpreter } from "./src/interpreter.js";

const source = `
SCENE entrance {
    SAY "Entrance"
    GOTO hallway
    SAY "Skipped"
}

SCENE hallway {
    SAY "Hallway"
}
`;

const lexer = new Lexer(source);
const tokens = lexer.scanTokens();

const parser = new Parser(tokens);
const ast = parser.parse();

const validator = new Validator(ast);
validator.validate();

const interpreter = new Interpreter(ast).run();
