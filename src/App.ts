import Register32 from './models/Register32';
import Operand, { OperandTypes } from './models/Operand';

export type Label = { label: string };
export type Command = { name: string; params: Operand[] };
export type CommandFunction = (app: App, params: Operand[]) => void;

export class App {
	registers: { [key: string]: Register32 };
	flags: { [key: string]: boolean };
	memory: Buffer;

	instructions: Command[];
	commandHandlers: { [key: string]: CommandFunction };

	subscriber: (() => void)[];

	constructor(commandHandlers: { [key: string]: CommandFunction }) {
		this.registers = {
			eax: new Register32(0),
			ebx: new Register32(0),
			ecx: new Register32(0),
			edx: new Register32(0),

			esi: new Register32(0),
			edi: new Register32(0),

			esp: new Register32(0x7fff),
			ebp: new Register32(0x7fff),

			eip: new Register32(0)
		};

		this.flags = {
			CF: false,
			PF: false,
			AF: false,
			ZF: false,
			SF: false,
			OF: false
		};

		// 16 bit memory
		this.memory = Buffer.alloc(0xffff);

		this.commandHandlers = commandHandlers;
		this.instructions = [ undefined ];
		this.subscriber = [];
	}

	subscribe(newSubscriber: () => void) {
		this.subscriber.push(newSubscriber);
	}

	runProgram(commands: (Command | Label)[], position?: number) {
		position = position || 0x7fff;
		this.writeProgram(commands, position);
		this.registers.eip._32 = position;

		this.subscriber.forEach((s) => s());
	}

	writeProgram(commands: (Command | Label)[], position: number) {
		let pos = position;
		let labels: { [key: string]: number } = {};
		let relPos = 0;

		for (let i = 0; i < commands.length; i++) {
			if ((commands[i] as Label).label) {
				labels[(commands[i] as Label).label] = pos + relPos;
			} else {
				relPos += 4;
			}
		}

		commands = commands.filter((v: any) => v.label === undefined).map((c: Command) => {
			for (let i = 0; i < c.params.length; i++) {
				if (c.params[i].type === OperandTypes.label) {
					c.params[i] = new Operand(OperandTypes.const, labels[c.params[i].value]);
				}
			}
			return c;
		});

		console.log(commands);

		let idx = this.instructions.length;

		for (const command of commands) {
			this.instructions.push(command as Command);
			this.memory.writeUInt32LE(idx++, pos);
			pos += 4;
		}
	}

	writeMemoryBytes(adresse: number, bytes: number[]) {
		for (const byte of bytes) {
			this.memory.writeUInt8(byte, adresse++);
		}
	}

	instructionCycle() {
		const iLoc = this.memory.readUInt32LE(this.registers.eip._32);

		if (iLoc >= this.instructions.length) throw new Error('NOP');
		let instrc = this.instructions[iLoc];
		if (!instrc) throw new Error('NOP');

		this.commandHandlers[instrc.name](this, instrc.params);

		this.subscriber.forEach((s) => s());
	}
}
