import { App, Command, Label } from '../App';
import { StringStream } from './StringStream';
import { syn_label, syn_include, CompilerError, syn_keywords, syn_registers } from './const';
import Operand, { OperandTypes } from '../models/Operand';
import { off } from 'codemirror';

export class Parser {
	app: App;
	currentLine: StringStream;
	libs: { [key: string]: (Command | Label)[] };

	constructor(app: App) {
		this.app = app;
		this.libs = {};
	}

	parseLib(libName: string, code: string, entryPoints: string[]) {
		let prefix = `__lib_${libName}_`;

		let compiled = this.parse(code);

		for (let i = 0; i < compiled.length; i++) {
			if ((compiled[i] as Label).label) {
				if (!entryPoints.includes((compiled[i] as Label).label)) {
					(compiled[i] as Label).label = prefix + (compiled[i] as Label).label;
				}
			} else {
				for (let j = 0; j < (compiled[i] as Command).params.length; j++) {
					const element = (compiled[i] as Command).params[j];
					if (element.type === OperandTypes.label) {
						if (!entryPoints.includes(element.value)) {
							element.value = prefix + element.value;
						}
					}
				}
			}
		}

		this.libs[libName] = [
			{
				name: 'jmp',
				params: [ new Operand(OperandTypes.label, prefix + 'libmain') ],
				lineNumber: 0
			}
		];
		this.libs[libName] = this.libs[libName].concat(compiled);
		this.libs[libName].push({ label: prefix + 'libmain', lineNumber: 0 });

		return this.libs[libName];
	}

	parse(code: string): (Command | Label)[] {
		let lines = code.split('\n');
		let instructions: (Command | Label)[] = [];

		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			this.currentLine = new StringStream(lines[lineIdx]);
			this.currentLine.eatWhitespaces();

			if (this.currentLine.eol()) continue;
			if (this.currentLine.eat(';')) continue;

			if (this.currentLine.rest().startsWith('#include')) {
				// Include statement
				this.currentLine.skip(8);
				this.currentLine.eatWhitespaces();

				if (this.currentLine.eol())
					throw new CompilerError('C001 - Missing libName after #include statement', lineIdx, {
						from: 0
					});
				// Also removes next symvol (if nothrow == ")
				if (this.currentLine.next() !== '"')
					throw new CompilerError('C002 - Unkown token after #include statement. Expected "', lineIdx, {
						from: this.currentLine.position
					});

				let preIdx = this.currentLine.position - 1;
				let libName = this.currentLine.eatWhile(/[A-z._/]/);

				if (this.currentLine.eol() || this.currentLine.peek() !== '"')
					throw new CompilerError('C003 - Missing closing token " in #include statment', lineIdx, {
						from: preIdx,
						to: this.currentLine.position
					});

				if (this.libs[libName] === undefined)
					throw new CompilerError(`C004 - Unknown libary identifier`, lineIdx, {
						from: preIdx,
						to: this.currentLine.position
					});

				instructions.concat(
					this.libs[libName].map((instr) => {
						instr.lineNumber = lineIdx;
						return instr;
					})
				);
			} else {
				const labelMatch = this.currentLine.match(syn_label, true) as RegExpMatchArray;
				if (labelMatch) {
					// Found label
					const label = labelMatch[0].substr(0, labelMatch[0].length - 1);
					if (label === 'libmain')
						throw new CompilerError('C005 - Forbidden Label "libmain"', lineIdx, {
							from: 0,
							to: this.currentLine.position
						});
					instructions.push({
						label: label,
						lineNumber: lineIdx
					});
				}

				// Normal Instruction
				const preCN = this.currentLine.position;
				const commandName = this.currentLine.eatWhile(/[A-z_0-9]/).toLowerCase();
				let params: Operand[] = [];

				if (!syn_keywords.test(commandName))
					throw new CompilerError('C006 - Invalid instruction', lineIdx, {
						from: preCN,
						to: this.currentLine.position
					});

				let i = 0;
				while (!this.currentLine.eol() && i < 16) {
					if (this.currentLine.peek() === ';') break;

					// Operand check

					let preOpParse = this.currentLine.position;
					this.currentLine.eat(',');
					if (this.currentLine.peek() === '[') {
						this.currentLine.next();
						this.currentLine.eatWhitespaces();

						if (!isNaN(parseInt(this.currentLine.peek()))) {
							// Direct Memory
							let matches = this.currentLine.match(
								/((0x[\dabcdef]+)|(0b[01]+)|([\d]+))[ ]*]/
							) as RegExpMatchArray;
							if (!matches)
								throw new CompilerError(
									'C007 - Invalid token for direct memory adressing. Expected [<number>]',
									lineIdx,
									{ from: preOpParse }
								);

							let number = parseInt(matches[0].substr(0, matches[0].length - 1));
							if (isNaN(number))
								throw new CompilerError('C008 - Invalid number string', lineIdx, { from: preOpParse });
							params.push(new Operand(OperandTypes.mDirect, number));
						} else {
							// Some Indirect Mem

							let contents = this.currentLine.eatWhile((c) => c !== ']');
							if (this.currentLine.peek() !== ']')
								throw new CompilerError('C009 - Missing closing token ]', lineIdx, {
									from: preOpParse,
									to: this.currentLine.position
								});
							contents = contents.trim();

							if (contents.includes('+') || contents.includes('-')) {
								// Indexed Memory Access
								let idx = contents.indexOf('+');
								if (idx === -1) idx = contents.indexOf('-');
								let regString = contents.substr(0, idx).trim().toLowerCase();

								if (!syn_registers.test(regString))
									throw new CompilerError('C010 - Invalid register', lineIdx, {
										from: preOpParse,
										to: this.currentLine.position
									});

								let offset = parseInt(contents.substr(idx + 1));
								if (isNaN(offset))
									throw new CompilerError('C011 - Invalid token. Expected number', lineIdx, {
										from: preOpParse,
										to: this.currentLine.position
									});

								params.push(
									new Operand(OperandTypes.mIndexed, [
										regString,
										contents.charAt(idx) == '+' ? offset : -offset
									])
								);
							} else {
								// Some Other

								const fReg = contents.toLowerCase();
								if (!syn_registers.test(fReg))
									throw new CompilerError('C012 - Invalid register', lineIdx, {
										from: preOpParse,
										to: this.currentLine.position
									});

								this.currentLine.eatWhitespaces();
								let preSecondParse = this.currentLine.position;
								if (this.currentLine.peek() === '[') {
									// DIndexed
									this.currentLine.next();
									let sReg = this.currentLine.eatWhile((c) => c !== ']');
									if (this.currentLine.peek() !== ']')
										throw new CompilerError('C013 - Missing closing token ]', lineIdx, {
											from: preSecondParse,
											to: this.currentLine.position
										});

									if (!syn_registers.test(sReg))
										throw new CompilerError('C014 - Invalid register', lineIdx, {
											from: preSecondParse,
											to: this.currentLine.position
										});

									params.push(new Operand(OperandTypes.mDIndexed, [ fReg, sReg ]));
								} else {
									// Indirect
									params.push(new Operand(OperandTypes.mIndirect, fReg));
								}
							}
						}
					} else {
						if (!isNaN(parseInt(this.currentLine.peek()))) {
							// Const

							let numStr = this.currentLine.match(
								/((0x[\dabcdef]+)|(0b[01]+)|([\d]+))/,
								true
							) as RegExpMatchArray;

							if (numStr === null)
								throw new CompilerError('C015 - Invalid token. Expected number', lineIdx, {
									from: preOpParse
								});

							let num = parseInt(numStr[0]);
							if (isNaN(num))
								throw new CompilerError('C015 - Invalid token. Expected number', lineIdx, {
									from: preOpParse
								});

							params.push(new Operand(OperandTypes.const, num));
						} else {
							// Register
							let desc = this.currentLine.eatWhile((c) => c !== ',').trim();
							if (syn_registers.test(desc)) {
								params.push(new Operand(OperandTypes.register, desc));
							} else {
								params.push(new Operand(OperandTypes.label, desc));
							}
						}
					}

					// Operand check over

					this.currentLine.eatWhitespaces();
					i++;
				}

				instructions.push({ name: commandName, params: params, lineNumber: lineIdx });
			}
		}

		return instructions;
	}
}
