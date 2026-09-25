import { TokenType } from './tokenTypes.js';


export class Parser{
    constructor(tokenArray){
        this.tokens = tokenArray;
        this.current = 0
    }

    peek(){
        const currentToken = this.tokens[this.current]
        return currentToken
    }

    isAtEnd(){
        const current = this.peek();
        return current.type === TokenType.EOF
    }

    previous(){
        return this.tokens[this.current - 1];
    }

    advance(){
        if(!this.isAtEnd()){
            this.current++;
        }
        return this.previous()
    }

    check(type){
        const current = this.peek();
        return type === current.type;
    }

    match(...types){
        for (const type of types){
            if (this.check(type)){
                this.advance();
                return true
            }
        }
        return false
    }

    consume(type, message){
        if(this.check(type)){
            return this.advance()
        }
        else{
            const current = this.peek();
            throw new SyntaxError(`Syntax Error at ${current.line} ${current.column}: ${message}`)
        }
    }


    parseScene(){
        this.consume(TokenType.SCENE, "Expected SCENE at the beginning of a scene.");
        const identifier = this.consume(TokenType.IDENTIFIER, "Expected scene name after SCENE.");
        this.consume(TokenType.LEFT_BRACE, `Expected "{" after scene name.`);
        const statements = [];
        while(!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()){
            statements.push(this.parseStatement())
        }
        this.consume(TokenType.RIGHT_BRACE, `Expected "}" after scene body.`);
        return {
            type: 'Scene',
            name: identifier.lexeme,
            statements: statements,
        }
    }

    parseSayStatement(){
        const stringToken = this.consume(TokenType.STRING, "Expected String after SAY.");
        return {
            type: "SayStatement",
            text: stringToken.literal,
        }
    }

    parseStatement(){
        if (this.match(TokenType.SAY)){
            return this.parseSayStatement()
        }
        else if (this.match(TokenType.SET)){
            return this.parseSetStatement();
        }
        else{
            const current = this.peek();
            throw new SyntaxError(`Syntax Error at ${current.line} ${current.column}: Expected a statement`)
        }
    }

    parseValue(){
        if(this.match(TokenType.STRING, TokenType.NUMBER, TokenType.TRUE, TokenType.FALSE)){
            const token = this.previous();
            return token.literal;
        }
        else{
            const current = this.peek();
            throw new SyntaxError(`Syntax Error at ${current.line} ${current.column}: Expected a string, number, true or false`)
        }
    }

    parseSetStatement(){
        const identifier = this.consume(TokenType.IDENTIFIER, "Expected variable name after SET")
        this.consume(TokenType.EQUAL, `Expected "=" after variable name`)
        const literal = this.parseValue();
        return {
            type: "SetStatement",
            name: identifier.lexeme,
            value: literal
        }
    }

    parse(){
        const scenes = [];
        while(!this.isAtEnd()){
            const parsed = this.parseScene();
            scenes.push(parsed)
        }
        return {
            type: "Program",
            scenes: scenes,
        }
    }


}