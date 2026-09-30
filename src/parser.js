import { TokenType } from "./tokenTypes.js";

export class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
    }

    peek() {
        return this.tokens[this.current];
    }

    isAtEnd() {
        return this.peek().type === TokenType.EOF;
    }

    previous() {
        return this.tokens[this.current - 1];
    }

    advance() {
        if (!this.isAtEnd()) {
            this.current++;
        }
        return this.previous();
    }

    check(type) {
        return this.peek().type === type;
    }

    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    syntaxError(token, message) {
        return new SyntaxError(
            `Syntax error at line ${token.line}, column ${token.column}: ${message}`,
        );
    }

    consume(type, message) {
        if (this.check(type)) {
            return this.advance();
        }
        throw this.syntaxError(this.peek(), message);
    }

    parseScene() {
        this.consume(TokenType.SCENE, "Expected SCENE at the beginning of a scene.");
        const identifier = this.consume(
            TokenType.IDENTIFIER,
            "Expected scene name after SCENE.",
        );
        this.consume(TokenType.LEFT_BRACE, `Expected "{" after scene name.`);

        const statements = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        this.consume(TokenType.RIGHT_BRACE, `Expected "}" after scene body.`);

        return {
            type: "Scene",
            name: identifier.lexeme,
            statements,
        };
    }

    parseSayStatement() {
        const stringToken = this.consume(
            TokenType.STRING,
            "Expected a string after SAY.",
        );
        return {
            type: "SayStatement",
            text: stringToken.literal,
        };
    }

    parseValue() {
        if (this.match(
            TokenType.STRING,
            TokenType.NUMBER,
            TokenType.TRUE,
            TokenType.FALSE,
        )) {
            return this.previous().literal;
        }

        throw this.syntaxError(
            this.peek(),
            "Expected a string, whole number, true, or false.",
        );
    }

    parseSetStatement() {
        const identifier = this.consume(
            TokenType.IDENTIFIER,
            "Expected variable name after SET.",
        );
        this.consume(TokenType.EQUAL, `Expected "=" after variable name.`);
        const value = this.parseValue();

        return {
            type: "SetStatement",
            name: identifier.lexeme,
            value,
        };
    }

    parseGotoStatement() {
        const identifier = this.consume(
            TokenType.IDENTIFIER,
            "Expected scene name after GOTO.",
        );
        return {
            type: "GotoStatement",
            target: identifier.lexeme,
        };
    }

    parseIfStatement() {
        const identifier = this.consume(
            TokenType.IDENTIFIER,
            "Expected condition variable after IF.",
        );
        this.consume(TokenType.LEFT_BRACE, `Expected "{" after IF condition.`);

        const statements = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            statements.push(this.parseStatement());
        }
        this.consume(TokenType.RIGHT_BRACE, `Expected "}" after IF block.`);

        return {
            type: "IfStatement",
            condition: identifier.lexeme,
            statements,
        };
    }

    parseChoiceOption() {
        const stringToken = this.consume(
            TokenType.STRING,
            "Expected choice text.",
        );
        this.consume(TokenType.ARROW, `Expected "->" after choice text.`);
        const identifierToken = this.consume(
            TokenType.IDENTIFIER,
            `Expected destination scene after "->".`,
        );

        return {
            text: stringToken.literal,
            target: identifierToken.lexeme,
        };
    }

    parseChoiceStatement() {
        this.consume(TokenType.LEFT_BRACE, `Expected "{" after CHOICE.`);
        if (this.check(TokenType.RIGHT_BRACE)) {
            throw this.syntaxError(
                this.peek(),
                "CHOICE requires at least one option.",
            );
        }

        const options = [];
        while (!this.check(TokenType.RIGHT_BRACE) && !this.isAtEnd()) {
            options.push(this.parseChoiceOption());
        }
        this.consume(TokenType.RIGHT_BRACE, `Expected "}" after CHOICE options.`);

        return {
            type: "ChoiceStatement",
            options,
        };
    }

    parseStatement() {
        if (this.match(TokenType.SAY)) {
            return this.parseSayStatement();
        }
        if (this.match(TokenType.SET)) {
            return this.parseSetStatement();
        }
        if (this.match(TokenType.GOTO)) {
            return this.parseGotoStatement();
        }
        if (this.match(TokenType.IF)) {
            return this.parseIfStatement();
        }
        if (this.match(TokenType.CHOICE)) {
            return this.parseChoiceStatement();
        }

        throw this.syntaxError(this.peek(), "Expected a statement.");
    }

    parse() {
        const scenes = [];
        while (!this.isAtEnd()) {
            scenes.push(this.parseScene());
        }

        return {
            type: "Program",
            scenes,
        };
    }
}
