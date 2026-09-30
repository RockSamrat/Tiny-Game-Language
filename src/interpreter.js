import { createInterface } from "node:readline/promises";

export class Interpreter {
    constructor(ast, options = {}) {
        this.ast = ast;
        this.scenes = new Map();
        this.variables = new Map();
        this.currentScene = null;
        this.input = options.input ?? process.stdin;
        this.outputStream = options.outputStream ?? process.stdout;
        this.output = options.output ?? console.log;
        this.question = options.question ?? null;
        this.readline = null;
    }

    buildSceneMap() {
        this.scenes.clear();
        for (const scene of this.ast.scenes) {
            if (this.scenes.has(scene.name)) {
                throw new Error(`Duplicate scene at runtime: ${scene.name}`);
            }
            this.scenes.set(scene.name, scene);
        }
    }

    async askQuestion(prompt) {
        if (this.question !== null) {
            return this.question(prompt);
        }

        if (this.readline === null) {
            this.readline = createInterface({
                input: this.input,
                output: this.outputStream,
            });
        }
        return this.readline.question(prompt);
    }

    displayChoice(choice) {
        choice.options.forEach((option, index) => {
            this.output(`${index + 1}. ${option.text}`);
        });
    }

    async executeChoice(choice) {
        if (!Array.isArray(choice.options) || choice.options.length === 0) {
            throw new Error("Cannot execute a CHOICE without options.");
        }

        this.displayChoice(choice);
        while (true) {
            const answer = String(
                await this.askQuestion("Choose an option: "),
            ).trim();

            if (/^[1-9]\d*$/.test(answer)) {
                const selectedIndex = Number(answer) - 1;
                if (selectedIndex < choice.options.length) {
                    return choice.options[selectedIndex].target;
                }
            }

            this.output(`Please enter a number from 1 to ${choice.options.length}.`);
        }
    }

    async executeStatement(statement) {
        switch (statement.type) {
            case "SayStatement":
                this.output(statement.text);
                return null;
            case "SetStatement":
                this.variables.set(statement.name, statement.value);
                return null;
            case "IfStatement":
                if (this.variables.get(statement.condition) === true) {
                    return this.executeStatements(statement.statements);
                }
                return null;
            case "GotoStatement":
                return statement.target;
            case "ChoiceStatement":
                return this.executeChoice(statement);
            default:
                throw new Error(`Unknown statement type: ${statement.type}`);
        }
    }

    // Targets propagate through nested IF blocks so GOTO and CHOICE stop the
    // old scene immediately.
    async executeStatements(statements) {
        if (!Array.isArray(statements)) {
            throw new Error("Expected a list of statements at runtime.");
        }

        for (const statement of statements) {
            const target = await this.executeStatement(statement);
            if (target !== null) {
                return target;
            }
        }
        return null;
    }

    closeReadline() {
        if (this.readline !== null) {
            this.readline.close();
            this.readline = null;
        }
    }

    async run() {
        try {
            if (this.ast?.type !== "Program" || !Array.isArray(this.ast.scenes)) {
                throw new Error("Interpreter expected a Program AST.");
            }

            this.buildSceneMap();
            this.variables.clear();
            if (this.ast.scenes.length === 0) {
                throw new Error("Program contains no scenes.");
            }

            let nextSceneName = this.ast.scenes[0].name;
            while (nextSceneName !== "END") {
                const scene = this.scenes.get(nextSceneName);
                if (scene === undefined) {
                    throw new Error(`Cannot enter unknown scene: ${nextSceneName}`);
                }

                this.currentScene = scene;
                const target = await this.executeStatements(scene.statements);
                if (target === null) {
                    this.currentScene = null;
                    return;
                }
                nextSceneName = target;
            }

            this.currentScene = null;
        }
        finally {
            this.closeReadline();
        }
    }
}
