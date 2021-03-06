import { App } from '../App';
import { DOMApp } from './DOMApp';

export let DOMMemoryRows = 10;
export let DOMMemoryCols = 8;

export class DOMMemory {
	private startAdresse: number = 0x0;
	private asInt: boolean = false;
	private asHex: boolean = true;
	private memSize: number = 1;
	private app: App;

	private memAddrControl: HTMLInputElement;
	private memSizeControl: HTMLInputElement;
	private memAsIntControl: HTMLInputElement;
	private memAsHexControl: HTMLInputElement;

	private memContent: HTMLDivElement;

	/**
	 * Creates a memory control component from th given application object
	 */
	constructor(domApp: DOMApp) {
		this.app = domApp.app;

		this.memContent = document.querySelector('.memory-content');

		this.memAddrControl = document.createElement('input');
		this.memAddrControl.classList.add('memAddr');
		this.memAddrControl.type = 'text';
		this.memAddrControl.value = '00000000';
		this.memAddrControl.id = 'inpMemAddr';
		this.memAddrControl.addEventListener('keyup', () => this.updateAddresse());

		let memAddrLabel = document.createElement('label');
		memAddrLabel.innerHTML = 'Addresse';

		document.querySelector('.memory-control').appendChild(memAddrLabel);
		document.querySelector('.memory-control').appendChild(this.memAddrControl);
		document.querySelector('.memory-control').appendChild(document.createElement('br'));
		// MEMSIZE

		this.memSizeControl = document.createElement('input');
		this.memSizeControl.type = 'text';
		this.memSizeControl.classList.add('memSize');
		this.memSizeControl.value = '1';
		this.memSizeControl.id = 'inpMemSize';
		this.memSizeControl.addEventListener('keyup', () => this.updateMemSize());

		let memSizeLabel = document.createElement('label');
		memSizeLabel.innerHTML = 'Bytes per field';

		document.querySelector('.memory-control').appendChild(memSizeLabel);
		document.querySelector('.memory-control').appendChild(this.memSizeControl);
		document.querySelector('.memory-control').appendChild(document.createElement('br'));

		// // ASINT

		this.memAsIntControl = document.createElement('input');
		this.memAsIntControl.type = 'checkbox';
		this.memAsIntControl.classList.add('memAsInt');
		this.memAsIntControl.checked = this.asInt;
		this.memAsIntControl.id = 'inpAsInt';
		this.memAsIntControl.addEventListener('change', () => this.updateAsInt());

		let memAsIntLabel = document.createElement('label');
		memAsIntLabel.innerHTML = 'As Int';

		document.querySelector('.memory-control').appendChild(memAsIntLabel);
		document.querySelector('.memory-control').appendChild(this.memAsIntControl);
		document.querySelector('.memory-control').appendChild(document.createElement('br'));

		this.memAsHexControl = document.createElement('input');
		this.memAsHexControl.type = 'checkbox';
		this.memAsHexControl.checked = this.asHex;
		this.memAsHexControl.classList.add('memAsInt');
		this.memAsHexControl.id = 'inpAsInt';
		this.memAsHexControl.addEventListener('change', () => this.updateAsHex());

		let memAsHexLabel = document.createElement('label');
		memAsHexLabel.innerHTML = 'As Hex';

		document.querySelector('.memory-control').appendChild(memAsHexLabel);
		document.querySelector('.memory-control').appendChild(this.memAsHexControl);
		document.querySelector('.memory-control').appendChild(document.createElement('br'));

		this.setupContent();
		this.update();

		domApp.subscribe(() => this.update());
	}

	/**
	 * User initiated change of the address-space to be show in the memory component.
	 */
	private updateAddresse() {
		this.startAdresse = parseInt(this.memAddrControl.value) || 0;
		this.update();
	}

	/**
	 * User initiated change of the cell-size to be show in the memory component.
	 */
	private updateMemSize() {
		this.memSize = parseInt(this.memSizeControl.value);
		this.setupContent();
		this.update();
	}

	/**
	 * User initiated change of the bit-casting to be show in the memory component.
	 */
	private updateAsInt() {
		this.asInt = this.memAsIntControl.checked;
		this.update();
	}

	/**
	 * User initiated change of the bit-casting to be show in the memory component.
	 */
	private updateAsHex() {
		this.asHex = this.memAsHexControl.checked;
		this.update();
	}

	/**
	 * User initiated change of the content if a memory cell (to be written into application memory)
	 */
	private updateMemCell(cell: HTMLInputElement) {
		let rowOffset = DOMMemoryRows * parseInt(cell.id[4]);
		let colOffset = this.memSize * parseInt(cell.id[6]);

		let offset = rowOffset + colOffset;
		if (isNaN(offset)) throw new Error('OFFSET FAILED');

		let val = parseInt(cell.value, this.asHex ? 16 : 10);
		if (isNaN(val)) throw new Error('VAL FAILED');

		switch (this.memSize) {
			case 1:
				this.asInt ? this.app.memory.writeInt8(val, offset) : this.app.memory.writeUInt8(val, offset);
				break;
			case 2:
				this.asInt ? this.app.memory.writeInt16LE(val, offset) : this.app.memory.writeUInt16LE(val, offset);
				break;
			case 4:
				this.asInt ? this.app.memory.writeInt32LE(val, offset) : this.app.memory.writeUInt32LE(val, offset);
				break;
		}
	}

	/**
	 * Initial setup of the memory component, without loading its content
	 */
	private setupContent() {
		this.memContent.innerHTML = '<!-- JS Generated Content -->';

		for (let i = 0; i < DOMMemoryRows; i++) {
			const row = document.createElement('div');
			row.classList.add('row');

			let label = document.createElement('input');
			label.id = 'row-label-' + i;
			label.type = 'text';
			label.classList.add('mem32');
			label.value = '0x' + (this.startAdresse + DOMMemoryRows * i).toString(16);
			label.disabled = true;
			row.appendChild(label);

			for (let j = 0; j < DOMMemoryCols / this.memSize; j++) {
				const ele = document.createElement('input');
				ele.type = 'text';
				ele.id = 'mem-' + i + '-' + j;
				ele.classList.add('mem' + this.memSize * 8);
				ele.value = '-';
				// ele.disabled = true;
				ele.addEventListener('change', (e) => this.updateMemCell(e.srcElement as HTMLInputElement));

				row.appendChild(ele);
			}
			this.memContent.appendChild(row);
		}
	}

	/**
	 * Update of the memory component, either due to memory change intiated by the application,
	 * or due to a change in the components options (addr, memSize or bit-casting)
	 */
	private update() {
		let addr = this.startAdresse;

		for (let i = 0; i < DOMMemoryRows; i++) {
			(document.getElementById('row-label-' + i) as HTMLInputElement).value = '0x' + addr.toString(16);
			for (let j = 0; j < DOMMemoryCols / this.memSize; j++) {
				let val;
				switch (this.memSize) {
					case 1:
						val = this.asInt ? this.app.memory.readInt8(addr) : this.app.memory.readUInt8(addr);
						addr += 1;
						break;
					case 2:
						val = this.asInt ? this.app.memory.readInt16LE(addr) : this.app.memory.readUInt16LE(addr);
						addr += 2;
						break;
					case 4:
						val = this.asInt ? this.app.memory.readInt32LE(addr) : this.app.memory.readUInt32LE(addr);
						addr += 4;
						break;
				}

				(document.getElementById('mem-' + i + '-' + j) as HTMLInputElement).value = val.toString(
					this.asHex ? 16 : 10
				);
			}
		}
	}
}

export default DOMMemory;
