import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";
import { Validator } from "./src/semanticValidator.js"

const source = `
SCENE entrance {
    SET hasKey = true

    IF hasKey {
        SAY "The door opens."
        GOTO basement
    }
}

SCENE hallway {
    SAY "You entered the hallway."
}
`;

const lexer = new Lexer(source);
const tokens = lexer.scanTokens();

const parser = new Parser(tokens);
const ast = parser.parse();

const validator = new Validator(ast);
validator.validate();

console.dir(ast, { depth: null });