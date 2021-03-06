import { CompilerError } from "../compiler/Common";
import { Compiler } from "../compiler/Compiler";
import { Lib } from "../lib/lib";
import SemiPersistentStorage from "./common";
import { DOMApp } from "./DOMApp";

export class DOMLibaryController {

    domApp: DOMApp;

    constructor(domApp: DOMApp) {
        this.domApp = domApp;
        this.build()
    }

    private build() {
        // Extract core container from DOM
        const container = document.querySelector(".libary-controller")

        // Libaries list component
        {
            const ul = document.createElement("ul");
            ul.classList.add("libary-list")
            for (const lib of Lib.libs) {
                ul.append(
                    this.generateListElement(lib)
                );
            }
            container.append(ul);
        }

        // "Save as Libary" component
        {
            const button = document.createElement("button")
            button.classList.add("saveLibary")
            button.innerHTML = "Save code as libary"
            button.addEventListener("click", () => this.saveLibary());
            container.append(button);
        }
    }

    private generateListElement(libName: string): HTMLLIElement {
        const li = document.createElement("li");

        li.id = "libaries_" +libName;

        const span = document.createElement("span");
        span.innerHTML = libName;

        const showButton = document.createElement("button")
        showButton.classList.add("showButton");
        showButton.innerHTML = "Show";
        showButton.addEventListener("click", () => this.domApp.libaryViewShowLibary(libName));

        if (Lib.isLocalLib(libName)) {
            const deleteButton = document.createElement("button")
            deleteButton.classList.add("libaryOptionButton");
            deleteButton.innerHTML = "Delete";
            deleteButton.addEventListener("click", () => this.deleteLibary(libName));
            li.append(showButton, deleteButton, span)
        } else {
            li.append(showButton, span);
        }

        return li
    }

    /**
     * 
     */
    private deleteLibary(libName: string): void {
        Lib.removeLib(this.domApp.app, libName);

        document.getElementById("libaries_" + libName).remove();
        document.getElementById("libary-dropdown:body").style.height = document.getElementById("libary-dropdown:body").scrollHeight + "px";
        
        // Cause an update to trigger syntax highlighting #include "deletedLibary"
        this.domApp.editor.setValue(this.domApp.editor.getValue());
    }

    /**
	 * Handles the creation of a Lib from the current code of the editor
	 */
	private saveLibary(): void {
        
        const text = this.domApp.editor.getDoc().getValue()
        const libLen = Lib.libs.length;

        try {
            const libName = Lib.setLib(this.domApp.app, null , text);
            SemiPersistentStorage.setData('editor:snapshot', this.domApp.editor.getDoc().getValue());

            if (libLen !== Lib.libs.length) {
                const li = this.generateListElement(libName);
                document.querySelector(".libary-list").append(li)

                // Resize Dropdown Container
                document.getElementById("libary-dropdown:body").style.height = document.getElementById("libary-dropdown:body").scrollHeight + "px";
            }
        } catch (e) {
            if (e instanceof CompilerError) {
                this.domApp.editor.markText(
					{ line: e.line, ch: e.position.from },
					{ line: e.line, ch: e.position.to || 255 },
					{ css: 'background-color: rgba(200, 50, 30, 0.5);' }
                );
                console.error(e);
            } else {
                throw e;
            }
        }
    }
}