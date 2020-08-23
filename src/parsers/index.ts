import { Command, Label } from '../App';
import Operand, { OperandTypes } from '../models/Operand';

export class Parser {
	private currentLine: string = '';

	parse(code: string): (Command | Label)[] {
		let lines = code.split('\n');
		let commands: (Command | Label)[] = [];

		for (const line of lines) {
			this.currentLine = line.trim();
			if (this.currentLine === '') continue;

			if (this.currentLine.includes(':')) {
				// LABEL
				let ddotpos = this.currentLine.indexOf(':');
				commands.push({ label: this.currentLine.substr(0, ddotpos) });
			} else {
				let whPos = this.currentLine.indexOf(' ') || this.currentLine.length - 1;
				let commandName = this.currentLine.substr(0, whPos).toLowerCase();
				let params: Operand[] = [];

				this.currentLine = this.currentLine.substr(whPos);
				let i = 0;
				while (this.currentLine !== '' && i < 16) {
					i++;
					params.push(this.parseOperand());
				}

				commands.push({ name: commandName, params: params });
			}
		}

		return commands;
	}

	private parseOperand(): Operand {
		this.currentLine = this.currentLine.trim();

		if (this.currentLine[0] === ',') this.currentLine = this.currentLine.substr(1).trimLeft();

		if (this.currentLine[0] === '[') {
			this.currentLine = this.currentLine.substr(1).trimLeft();
			if (!isNaN(parseInt(this.currentLine[0], 10))) {
				// Direct Memory
				let idx = this.currentLine.indexOf(']');
				if (idx === -1) throw new Error('MISSING ]');
				let num = parseInt(this.currentLine.substr(0, idx));
				this.currentLine = this.currentLine.substr(idx + 1);

				if (isNaN(num)) throw new Error('NOPARSE');
				return new Operand(OperandTypes.mDirect, num);
			} else {
				let idx = this.currentLine.indexOf(']');
				if (idx === -1) throw new Error('MISSING ]');
				let firstFieldDesc = this.currentLine.substr(0, idx);
				this.currentLine = this.currentLine.substr(idx + 1).trim();

				if (firstFieldDesc.includes('+')) {
					// Indexed
					let pIdx = firstFieldDesc.indexOf('+');
					let reg = firstFieldDesc.substr(0, pIdx).trim().toLowerCase();
					if (!validRegisters.includes(reg)) throw new Error('w reg');

					let offset = parseInt(firstFieldDesc.substr(pIdx + 1));
					if (isNaN(offset)) throw new Error('INT');

					return new Operand(OperandTypes.mIndexed, [ reg, offset ]);
				} else {
					let fRegDesc = firstFieldDesc.trim().toLowerCase();
					if (!validRegisters.includes(fRegDesc)) throw new Error('reg');

					if (this.currentLine[0] === '[') {
						this.currentLine = this.currentLine.substr(1);
						let idx = this.currentLine.indexOf(']');
						if (idx === -1) throw new Error('MISSING ]');
						let reg = this.currentLine.substr(0, idx).trim().toLowerCase();
						this.currentLine = this.currentLine.substr(idx + 1);

						if (!validRegisters.includes(reg)) throw new Error('NOREG');
						return new Operand(OperandTypes.mDIndexed, [ fRegDesc, reg ]);
					} else {
						// Indirect
						return new Operand(OperandTypes.mIndirect, fRegDesc);
					}
				}
			}
		} else {
			if (!isNaN(parseInt(this.currentLine[0], 10))) {
				// Const
				let whPos = this.currentLine.indexOf(',');
				if (whPos === -1) whPos = this.currentLine.length;
				let num = parseInt(this.currentLine.substr(0, whPos));
				this.currentLine = this.currentLine.substr(whPos + 1);
				if (isNaN(num)) throw new Error('PARSER INT ERROR');
				return new Operand(OperandTypes.const, num);
			} else {
				// Register
				let whPos = this.currentLine.indexOf(',');
				if (whPos === -1) whPos = this.currentLine.length;
				let desc = this.currentLine.substr(0, whPos).trim().toLowerCase();
				this.currentLine = this.currentLine.substr(whPos + 1);

				if (!validRegisters.includes(desc)) throw new Error('INV REG');

				return new Operand(OperandTypes.register, desc);
			}
		}
	}
}

let validRegisters = [
	'eax',
	'ax',
	'ah',
	'al',
	'ebx',
	'bx',
	'bh',
	'bl',
	'ecx',
	'cx',
	'ch',
	'cl',
	'edx',
	'dx',
	'dh',
	'dl',
	'edi',
	'esi',
	'esp',
	'ebp'
];

export default Parser;
