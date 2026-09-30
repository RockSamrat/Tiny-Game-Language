import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Lexer } from "./src/lexer.js";
import { Parser } from "./src/parser.js";
import { Validator } from "./src/semanticValidator.js";
import { Interpreter } from "./src/interpreter.js";

export async function runSource(source, interpreterOptions = {}) {
    const tokens = new Lexer(source).scanTokens();
    const ast = new Parser(tokens).parse();
    new Validator(ast).validate();

    const interpreter = new Interpreter(ast, interpreterOptions);
    await interpreter.run();
    return interpreter;
}

export async function main(args = process.argv.slice(2)) {
    const filename = args[0];
    if (filename === undefined) {
        throw new Error(
            "No story file provided. Usage: node index.js <story-file>",
        );
    }

    const storyPath = path.resolve(filename);
    let source;
    try {
        source = await readFile(storyPath, "utf8");
    }
    catch (error) {
        throw new Error(
            `Could not read story file "${filename}": ${error.message}`,
        );
    }

    await runSource(source);
}

const isMainModule = process.argv[1] !== undefined
    && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isMainModule) {
    main().catch((error) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });
}
