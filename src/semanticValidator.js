

export class Validator{
    constructor(ast){
        this.ast = ast;
        this.sceneNames = new Set();
        this.variables = new Set();
    }

    collectSceneNames(){
        for (const scene of this.ast.scenes){
            if(this.sceneNames.has(scene.name)){
                throw new Error(`Duplicate Scene Names: ${scene.name}`)
            }
            this.sceneNames.add(scene.name);
        }
    }
    
    validateStatement(statements){
        for (const statement of statements){
            if (statement.type === "GotoStatement"){
                if (!this.sceneNames.has(statement.target)){
                    throw new Error(`Scene does not exist: ${statement.target}`)
                }
            }
            if (statement.type === "ChoiceStatement"){
                for (const option of statement.options){
                    if(!this.sceneNames.has(option.target)){
                        throw new Error(`Scene does not exist: ${option.target}`)
                    }
                }
            }
            if (statement.type === "IfStatement"){
                if(!this.variables.has(statement.condition)){
                    throw new Error(`Variable does not exist: ${statement.condition}`)
                }
                this.validateStatement(statement.statements)
            }
        }
    }

    collectVariables(statements){
        for (const statement of statements){
            if(statement.type === 'SetStatement'){
                this.variables.add(statement.name)
            }
            if(statement.type === 'IfStatement'){
                this.collectVariables(statement.statements)
            }
        }
    }
    
    validateAllStatements(){
            for (const scene of this.ast.scenes){
                this.validateStatement(scene.statements);
            }
    }

    validate(){
        this.collectSceneNames();
        for (const scene of this.ast.scenes){
            this.collectVariables(scene.statements);
        }
        this.validateAllStatements();
        return true;
    }
}