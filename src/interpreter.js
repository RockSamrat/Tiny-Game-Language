export class intrepreter{
    constructor(ast){
        this.ast = ast;
        this.scenes = new Map();
        this.variables = new Map();
        this.currentScene = null;
    }
}