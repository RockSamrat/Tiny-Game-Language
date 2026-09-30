export class Interpreter{
    constructor(ast){
        this.ast = ast;
        this.scenes = new Map();
        this.variables = new Map();
        this.currentScene = null;
    }

    buildSceneMap(){
        for (const scene of this.ast.scenes){
            this.scenes.set(scene.name, scene)
        }
    }

    statementExecution(statement){
        if(statement.type === 'SayStatement'){
            console.log(statement.text)
        }
        else if(statement.type === 'SetStatement'){
            this.variables.set(statement.name, statement.value)
        }
        else if(statement.type === 'IfStatement'){
            if(this.variables.get(statement.condition) === true){
                const results = this.executeStatements(statement.statements)
                return results
            }
        }
        else if(statement.type === 'GotoStatement'){
            const result = statement.target
            return result
        }
        else if(statement.type = "ChoiceStatement"){
            displayChoice(statement)
        }
    }

    executeStatements(statements){
        for(const statement of statements){
            const value = this.statementExecution(statement)
            if(value !== null && value !== undefined){
                return value
            }
        }
        return null
    }

    displayChoice(choice){
        choice.options.forEach((option, index) => {
            console.log(`${index+1}. ${option.text}`)
        })
    }

    run(){
        this.buildSceneMap();
        if (this.ast.scenes.length === 0){
            throw new Error(`Program contains no scene.`)
        }
        this.currentScene = this.ast.scenes[0];
        while(this.currentScene !== null){
            const result = this.executeStatements(this.currentScene.statements);
            if(result === null){
                return
            }
            else{
                this.currentScene = this.scenes.get(result)
            }
        }
    }
}