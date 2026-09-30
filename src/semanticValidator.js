export class SemanticValidator {
    constructor(ast) {
        this.ast = ast;
        this.sceneNames = new Set();
        this.variables = new Set();
    }

    collectSceneNames() {
        for (const scene of this.ast.scenes) {
            if (this.sceneNames.has(scene.name)) {
                throw new Error(`Duplicate Scene Names: ${scene.name}`);
            }
            this.sceneNames.add(scene.name);
        }
    }

    collectVariables(statements) {
        for (const statement of statements) {
            if (statement.type === "SetStatement") {
                this.variables.add(statement.name);
            }
            if (statement.type === "IfStatement") {
                this.collectVariables(statement.statements);
            }
        }
    }

    validateTarget(target) {
        if (target !== "END" && !this.sceneNames.has(target)) {
            throw new Error(`Scene does not exist: ${target}`);
        }
    }

    validateStatements(statements) {
        for (const statement of statements) {
            if (statement.type === "GotoStatement") {
                this.validateTarget(statement.target);
            }
            else if (statement.type === "ChoiceStatement") {
                for (const option of statement.options) {
                    this.validateTarget(option.target);
                }
            }
            else if (statement.type === "IfStatement") {
                if (!this.variables.has(statement.condition)) {
                    throw new Error(`Variable does not exist: ${statement.condition}`);
                }
                this.validateStatements(statement.statements);
            }
        }
    }

    validateAllStatements() {
        for (const scene of this.ast.scenes) {
            this.validateStatements(scene.statements);
        }
    }

    validate() {
        if (this.ast?.type !== "Program" || !Array.isArray(this.ast.scenes)) {
            throw new Error("Semantic validator expected a Program AST.");
        }

        this.sceneNames.clear();
        this.variables.clear();
        this.collectSceneNames();
        for (const scene of this.ast.scenes) {
            this.collectVariables(scene.statements);
        }
        this.validateAllStatements();
        return true;
    }
}

// Preserve the original public class name for existing callers.
export { SemanticValidator as Validator };
