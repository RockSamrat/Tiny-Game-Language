import { TokenType } from "./tokenTypes.js";
import { Token } from "./token.js";

export class Lexer {
    constructor(source) {
        if (typeof source !== "string") {
            throw new TypeError("Lexer source must be a string.");
        }

        this.source = source;
        this.tokens = [];
        this.start = 0;
        this.current = 0;
        this.line = 1;
        this.column = 1;
        this.keywords = {
            SCENE: TokenType.SCENE,
            SAY: TokenType.SAY,
            SET: TokenType.SET,
            IF: TokenType.IF,
            GOTO: TokenType.GOTO,
            CHOICE: TokenType.CHOICE,
            true: TokenType.TRUE,
            false: TokenType.FALSE,
        };
    }

    isAtEnd() {
        return this.current >= this.source.length;
    }

    advance() {
        const character = this.source[this.current];
        this.current++;
        this.column++;
        return character;
    }

    addToken(tokenType, literal = null) {
        const lexeme = this.source.slice(this.start, this.current);
        const token = new Token(
            tokenType,
            lexeme,
            literal,
            this.startLine,
            this.startColumn,
        );

        this.tokens.push(token);
    }

    lexicalError(message) {
        return new SyntaxError(
            `Lexical error at line ${this.startLine}, column ${this.startColumn}: ${message}`,
        );
    }

    scanString() {
        while (!this.isAtEnd() && this.peek() !== `"`) {
            if (this.peek() === "\n" || this.peek() === "\r") {
                throw this.lexicalError("Multiline strings are not allowed.");
            }
            this.advance();
        }

        if (this.isAtEnd()) {
            throw this.lexicalError("Unterminated string.");
        }

        this.advance();
        const literal = this.source.slice(this.start + 1, this.current - 1);
        this.addToken(TokenType.STRING, literal);
    }

    match(character) {
        if (this.isAtEnd() || character !== this.source[this.current]) {
            return false;
        }

        this.advance();
        return true;
    }

    isIdentifierStart(character) {
        return character !== null && (
            (character >= "a" && character <= "z")
            || (character >= "A" && character <= "Z")
            || character === "_"
        );
    }

    isDigit(character) {
        return character !== null && character >= "0" && character <= "9";
    }

    isIdentifierPart(character) {
        return this.isIdentifierStart(character) || this.isDigit(character);
    }

    scanIdentifier() {
        while (this.isIdentifierPart(this.peek())) {
            this.advance();
        }

        const word = this.source.slice(this.start, this.current);
        let tokenType = this.keywords[word];
        if (tokenType === undefined) {
            tokenType = TokenType.IDENTIFIER;
        }
        else if (tokenType === TokenType.TRUE) {
            this.addToken(tokenType, true);
            return;
        }
        else if (tokenType === TokenType.FALSE) {
            this.addToken(tokenType, false);
            return;
        }

        this.addToken(tokenType);
    }

    scanNumber() {
        while (this.isDigit(this.peek())) {
            this.advance();
        }

        const numberText = this.source.slice(this.start, this.current);
        this.addToken(TokenType.NUMBER, Number(numberText));
    }

    peek() {
        if (this.isAtEnd()) {
            return null;
        }

        return this.source[this.current];
    }

    scanTokens() {
        while (!this.isAtEnd()) {
            this.start = this.current;
            this.startLine = this.line;
            this.startColumn = this.column;
            const currentCharacter = this.advance();

            switch (currentCharacter) {
                case "{":
                    this.addToken(TokenType.LEFT_BRACE);
                    break;
                case "}":
                    this.addToken(TokenType.RIGHT_BRACE);
                    break;
                case "=":
                    this.addToken(TokenType.EQUAL);
                    break;
                case " ":
                case "\t":
                case "\r":
                    break;
                case "\n":
                    this.line++;
                    this.column = 1;
                    break;
                case "-":
                    if (!this.match(">")) {
                        throw this.lexicalError('Unexpected character "-".');
                    }
                    this.addToken(TokenType.ARROW);
                    break;
                case `"`:
                    this.scanString();
                    break;
                default:
                    if (this.isIdentifierStart(currentCharacter)) {
                        this.scanIdentifier();
                    }
                    else if (this.isDigit(currentCharacter)) {
                        this.scanNumber();
                    }
                    else {
                        throw this.lexicalError(
                            `Unexpected character "${currentCharacter}".`,
                        );
                    }
            }
        }

        this.tokens.push(new Token(
            TokenType.EOF,
            "",
            null,
            this.line,
            this.column,
        ));
        return this.tokens;
    }
}
