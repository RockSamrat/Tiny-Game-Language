import test from "node:test";
import assert from "node:assert/strict";

import { Lexer } from "../src/lexer.js";
import { Parser } from "../src/parser.js";
import { Validator } from "../src/semanticValidator.js";

function validateSource(source) {
    const lexer = new Lexer(source);
    const tokens = lexer.scanTokens();

    const parser = new Parser(tokens);
    const ast = parser.parse();

    const validator = new Validator(ast);
    return validator.validate();
}

test("accepts a valid program", () => {
    const source = `
        SCENE entrance {
            SET hasKey = true

            IF hasKey {
                SAY "The door opens"
                GOTO hallway
            }
        }

        SCENE hallway {
            SAY "You entered the hallway"
        }
    `;

    assert.equal(validateSource(source), true);
});

test("rejects duplicate scene names", () => {
    const source = `
        SCENE entrance {
            SAY "First entrance"
        }

        SCENE entrance {
            SAY "Second entrance"
        }
    `;

    assert.throws(
        () => validateSource(source),
        /Duplicate Scene Names: entrance/
    );
});

test("rejects a missing GOTO target", () => {
    const source = `
        SCENE entrance {
            GOTO missingScene
        }
    `;

    assert.throws(
        () => validateSource(source),
        /Scene does not exist: missingScene/
    );
});

test("rejects a missing CHOICE target", () => {
    const source = `
        SCENE entrance {
            CHOICE {
                "Enter the room" -> missingRoom
            }
        }
    `;

    assert.throws(
        () => validateSource(source),
        /Scene does not exist: missingRoom/
    );
});

test("rejects an undefined IF variable", () => {
    const source = `
        SCENE entrance {
            IF hasKey {
                SAY "The door opens"
            }
        }
    `;

    assert.throws(
        () => validateSource(source),
        /Variable does not exist: hasKey/
    );
});

test("rejects a missing GOTO target inside a nested IF", () => {
    const source = `
        SCENE entrance {
            SET hasKey = true

            IF hasKey {
                IF hasKey {
                    GOTO missingRoom
                }
            }
        }
    `;

    assert.throws(
        () => validateSource(source),
        /Scene does not exist: missingRoom/
    );
});

test("allows END as a GOTO and CHOICE destination", () => {
    const source = `
        SCENE entrance {
            SET finished = true
            IF finished {
                GOTO END
            }
            CHOICE {
                "Finish" -> END
            }
        }
    `;

    assert.equal(validateSource(source), true);
});

test("rejects an undefined IF variable inside a nested IF", () => {
    const source = `
        SCENE entrance {
            SET outer = true
            IF outer {
                IF missing {
                    SAY "Never"
                }
            }
        }
    `;

    assert.throws(
        () => validateSource(source),
        /Variable does not exist: missing/
    );
});

test("accepts variables defined in nested blocks", () => {
    const source = `
        SCENE entrance {
            IF outer {
                SET outer = true
                SET inner = false
                IF inner {
                    SAY "Nested"
                }
            }
        }
    `;

    assert.equal(validateSource(source), true);
});
