let self = class ProgressSlider extends HTMLElement {
	sliderElement = null;
	valueElement = null;
	#slots = {};

	static tagName = "progress-slider";
	static observedAttributes = ["min", "max", "step", "value", "show"];

	constructor () {
		super();

		this.attachShadow({mode: "open"});
		let styleURL = new URL(self.tagName + ".css", import.meta.url);
		this.shadowRoot.innerHTML = `
			<style>@import url("${ styleURL }")</style>
			<slot>
				<input type="range">
			</slot>
			<slot name="value">
				<input type="number">
			</slot>
		`;

		this.#slots = Object.fromEntries([...this.shadowRoot.querySelectorAll("slot")].map(slot => [slot.name || "slider", slot]));

		this.#slots.slider.addEventListener("slotchange", this);
		this.#slots.value.addEventListener("slotchange", this);

		this.handleEvent({type: "slotchange"});
	}

	handleEvent (event) {
		if (event.type === "slotchange") {
			let source = "slider";

			for (let name in this.#slots) {
				let slot = this.#slots[name];
				let elementProp = name + "Element";
				let oldElement = this[elementProp];
				let nodes = slot.assignedNodes();
				let elements = slot.assignedElements();

				if (name === "slider" && elements.length === 0 && nodes.every(node => !node.nodeValue.trim())) {
					// Literally every node assigned to this slot is an empty text node. Likely formatting, remove it.
					// See https://twitter.com/LeaVerou/status/1785904086929346957
					nodes.forEach(node => node.remove());
				}

				let element = slot.assignedElements()[0];

				if (name !== source && element) {
					source = name;
				}

				element ??= slot.firstElementChild;
				this[elementProp] = element;

				["min", "max", "step"].forEach(prop => this[elementProp][prop] = this[prop]);

				if (oldElement !== this[elementProp]) {
					oldElement?.removeEventListener("input", this);
					this[elementProp]?.addEventListener("input", this);
				}
			}

			this[source + "Element"].dispatchEvent(new Event("input", {bubbles: true}));
		}
		else if (event.type === "input") {
			if (event.target === this.sliderElement) {
				this.#valueChanged({source: "slider"});
			}
			else if (event.target === this.valueElement) {
				this.#valueChanged({source: "value"});
			}

			this.dispatchEvent(new Event("input", {
				bubbles: true,
				originalTarget: event.target,
			}));
		}
	}

	#valueChanged ( {source} ) {
		let value = this[source + "Element"].value;

		if (source === "slider") {
			this.valueElement.value = this.show === "progress" ? this.progressAt(value) : value;
		}
		else if (source === "value") {
			this.sliderElement.value = this.show === "progress" ? this.valueAt(value) : value;
		}

		this.style.setProperty("--value", this.value);
		this.style.setProperty("--progress", this.progress);

		if (!CSS.supports("field-sizing", "content")) {
			let valueStr = this.value + "";
			this.valueElement.style.setProperty("--value-length", valueStr.length);
		}
	}

	get show () {
		return this.getAttribute("show");
	}

	set show (value) {
		this.setAttribute("show", value);
	}

	get progress () {
		return this.progressAt(this.value);
	}

	progressAt (value) {
		return (value - this.min) / (this.max - this.min);
	}

	valueAt (progress) {
		return this.min + progress * (this.max - this.min);
	}

	attributeChangedCallback (name, oldValue, newValue) {
		if (oldValue === newValue) {
			return;
		}

		if (name === "show") {
			if (newValue === "progress") {
				this.valueElement.setAttribute("min", 0);
				this.valueElement.setAttribute("max", 1);

				// `step` should be proportional to the one the component already has.
				this.valueElement.setAttribute("step", this.step / (this.max - this.min));
			}
			else {
				["min", "max", "step"].forEach(prop => this.valueElement.setAttribute(prop, this[prop]));
			}
		}
		else {
			this.sliderElement.setAttribute(name, newValue);
			this.valueElement.setAttribute(name, newValue);

			if (["min", "max", "value"].includes(name)) {
				this.style.setProperty("--progress", this.progress);
			}
		}
	}
}

let defaults = {
	min: 0,
	max: 100,
	step: 1,
	value: 50,
	defaultValue: 50,
}

for (let prop of Object.keys(defaults)) {
	Object.defineProperty(self.prototype, prop, {
		get () {
			let value = this.sliderElement[prop]
			return value === "" ? defaults[prop] : Number(value);
		},
		set (value) {
			let oldValue = this.sliderElement[prop];

			if (oldValue !== value) {
				this.sliderElement[prop] = value;
				this.valueElement[prop] = value;
			}
		},
	});
}

customElements.define(self.tagName, self);

export default self;