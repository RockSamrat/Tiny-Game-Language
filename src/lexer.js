import { TokenType } from "./tokenTypes.js";
import { Token } from "./token.js";


export class Lexer{
    constructor(source){
        this.source = source;
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.keywords = {
            SCENE  : TokenType.SCENE,
            SAY    : TokenType.SAY,
            SET    : TokenType.SET,
            IF     : TokenType.IF,
            GOTO   : TokenType.GOTO,
            CHOICE : TokenType.CHOICE,
            true   : TokenType.TRUE,
            false  : TokenType.FALSE,
        }
    }

    isAtEnd(){
        return this.current >= this.source.length;
    }

    advance(){
        const character = this.source[this.current]

        this.current = this.current + 1;
        this.column = this.column + 1;

        return character;
    }

    addToken(tokenType, literal = null){
        const lexeme = this.source.slice(this.start, this.current)
        const token = new Token (
            tokenType,
            lexeme,
            literal,
            this.startLine,
            this.startColumn,
        )

        this.tokens.push(token);
    }

    scanString(){
        while (!this.isAtEnd() && this.peek() !== `"`){
            if (this.peek() === "\n"){
                console.error(`Multiline strings are not allowed at line: ${this.line}, Column: ${this.column}`)
                return
            }
            this.advance();
        }
        if (this.isAtEnd()){
            console.error(` Unterminated string at line: ${this.line}, Column: ${this.column}`)
            return
        }
        this.advance()
        const literal = this.source.slice(this.start + 1, this.current - 1);
        this.addToken(TokenType.STRING, literal);
    }

    match(character){
        if (this.isAtEnd()){
            return false
        }
        else if(character !== this.source[this.current]){
            return false
        }
        else{
            this.advance();
            return true
        }
    }

    isAlphabet(character){
        if(character === null){
            return false
        }
        if (character >= "a" && character <= "z"){
            return true
        }
        else if (character >= "A" && character <= "Z"){
            return true
        }
        else{
            return false
        }
    }

    isNumber(character){
        if(character === null){
            return false
        }
        if (character >= "0" && character <= "9"){
            return true
        }
        else{
            return false
        }
    }

    isAlphaNumeric(character){
        return this.isAlphabet(character) || this.isNumber(character)
    }

    scanIdentifier(){
        while (this.isAlphaNumeric(this.peek())){
            this.advance();
        }
        const word = this.source.slice(this.start, this.current);
        let tokenType = this.keywords[word]
        if (tokenType === undefined){
            tokenType = TokenType.IDENTIFIER
        }
        else if (tokenType === TokenType.TRUE){
            this.addToken(tokenType, true)
            return
        }
        else if (tokenType === TokenType.FALSE){
            this.addToken(tokenType, false)
            return
        }
        this.addToken(tokenType)
    }

    scanNumber(){
        while (this.isNumber(this.peek())){
            this.advance();
        }
        const numberText = this.source.slice(this.start, this.current);
        const numberValue = Number(numberText);
        this.addToken(TokenType.NUMBER, numberValue)
    }

    peek(){
        if (this.isAtEnd()){
            return null
        }
        else{
            const character = this.source[this.current]
            return character
        }
    }

    scanTokens(){
        while(!this.isAtEnd()){
            this.start = this.current;
            this.startLine = this.line;
            this.startColumn = this.column;
            const currentCharacter = this.advance()

            switch (currentCharacter) {
                case "{":
                    this.addToken(TokenType.LEFT_BRACE)
                    break;
                case "}":
                    this.addToken(TokenType.RIGHT_BRACE)
                    break;
                case "=":
                    this.addToken(TokenType.EQUAL)
                    break;
                case " ":
                    break;
                case "\t":
                    break;
                case "\r":
                    break;
                case "\n":
                    this.line++;
                    this.column = 1;
                    break;
                case "-":
                    if (this.match(">")){
                        this.addToken(TokenType.ARROW)
                    } 
                    else {
                        console.error(`Lexical error at line: ${this.startLine}, column: ${this.startColumn}, Unexpected character "${currentCharacter}"`)
                    }
                    break;
                case `"`:
                    this.scanString();
                    break;
                default:
                    if (this.isAlphabet(currentCharacter)){
                        this.scanIdentifier();
                    }
                    else if (this.isNumber(currentCharacter)){
                        this.scanNumber();
                    }
                    else {
                    console.error(`Lexical error at line: ${this.startLine}, column: ${this.startColumn}, Unexpected character "${currentCharacter}"`)
                    }
            }
        }
        const finalToken = new Token (
            TokenType.EOF,
            "",
            null,
            this.line,
            this.column,
        )
        this.tokens.push(finalToken)
        return this.tokens;
    }
}