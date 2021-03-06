import { App, Command, CompiledCode, Label } from "../App";
import Operand, { OperandTypes } from "./Operand";

export class Programm {

    public text: CompiledCode;
    public data: DataConstant[];

    public options: { [key:string]: string };
    public exportLabels: string[];

    public depenencies: string[];

    constructor(text: CompiledCode, data: DataConstant[]) {
        this.text = text;
        this.data = data;

        this.options = {};
        this.exportLabels = [];
        this.depenencies = [];
    }

    /**
     * Writes the programm into the memory of the given application.
     * Uses memory from the given space downwards.
     * Returns the address of the first not used memory cell;
     */
    public write(app: App, memoryPosition: number) {

        let pos;

        /// RESOLVE INSTRUCTIONS
        let labelPositions: { [key:string]: number} = {};
        let relPos: number = 0;

        // Extract relative label position from source
        for (let i = 0; i < this.text.length; i++) {
            const element = this.text[i];
            if ((element as Label).label) {
                labelPositions[(element as Label).label] = relPos
            } else {
                relPos += 4;
            }
        }

        // Cut out labels & calulcate required spaec
        const commands: Command[] = this.text.filter((v: Label) => v.label === undefined) as Command[]
        const textPos = memoryPosition - 4*commands.length;                            
        
        /// RESOLVE DATA (+4bytes Padding)
        const dataPos = textPos - this.data.reduce((p, dc) => p + dc.totalRequiredMemSpace, 0) - 4
        let dataPositions: { [key: string]: number } = {};
        pos = dataPos;

        // Writes constants to memory
        for (let i = 0; i < this.data.length; i++) {
            const dc = this.data[i];
            dataPositions[dc.name] = pos;
            for (const val of dc.raw) {
                if (dc.memSpace === 1) app.memory.writeUInt8(val || 0, pos);
                if (dc.memSpace === 2) app.memory.writeUInt16LE(val || 0, pos);
                if (dc.memSpace === 4) app.memory.writeUInt32LE(val || 0, pos);

                pos += dc.memSpace;
            }
        }

        pos += 4; // Padding

        // Replace label Operands
        for (let i = 0; i < commands.length; i++) {
            for (let j = 0; j < commands[i].params.length; j++) {
                // Replace label operands with direct jumps
                if (commands[i].params[j].type === OperandTypes.label) {
                    commands[i].params[j] = new Operand(OperandTypes.const, labelPositions[commands[i].params[j].value] + textPos);
                }
                
                // Replace offsets with direct memory addresses
                if (commands[i].params[j].type === OperandTypes.dataOffset) {
                    commands[i].params[j] = new Operand(OperandTypes.const, dataPositions[commands[i].params[j].value]);
                }

                if (commands[i].params[j].type === OperandTypes.dataMReference) {
                    commands[i].params[j] = new Operand(OperandTypes.mDirect, dataPositions[commands[i].params[j].value]);
                }
            }
        }

        // Writes instructions into application memory & checks for first relevant command1
        let startPosOfUserCode: number;
        let idx = app.instructions.length;
        for (const command of commands) {
            if (startPosOfUserCode === undefined && !command.isLibCode) {
                startPosOfUserCode = pos;
            }
            app.instructions.push(command);
            app.memory.writeUInt32LE(idx++, pos);
            pos += 4;
        }

        // Setup application for stack based context
        app.registers.eip._32 = startPosOfUserCode || textPos;
        app.registers.esp._32 = dataPos - 1;
        app.registers.ebp._32 = dataPos - 1;

        console.info(`[Core] Written executable ${this.options.name ? `"${this.options.name}" ` : ""}to memory 0x${dataPos.toString(16)} to 0x${memoryPosition.toString(16)} (${memoryPosition - dataPos} bytes)`)
    }
}

export class DataConstant {

    public name: string;
    public memSpace: number;
    public raw: number[];

    public lineNumber: number

    public get totalRequiredMemSpace(): number {
        return this.memSpace * this.raw.length;
    }

    constructor(name: string, memSpace: number, raw: number[], lineNumber: number) {
        this.name = name;
        this.memSpace = memSpace;
        this.raw = raw;
        this.lineNumber = lineNumber;
    }
}