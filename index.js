import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";

const source = `
SCENE entrance {
    SET hasKey = true

    IF hasKey {
        SAY "The door opens."
        GOTO hallway
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

console.dir(ast, { depth: null });