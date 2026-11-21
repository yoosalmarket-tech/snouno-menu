import { el, field, button } from "../payment-ui.js";
export function editOrderOptions(form, stored = []) {
  const panel = el("section");
  panel.className = "pay-config";
  form.append(panel);
  const groups = structuredClone(stored || []);
  function control(parent, obj, key, label, type = "text") {
    const input = el("input");
    input.type = type;
    if (type === "checkbox") input.checked = !!obj[key];
    else input.value = obj[key] ?? "";
    if (type === "number") {
      input.min = 0;
      input.step = ".01";
    }
    input.oninput = () =>
      (obj[key] =
        type === "checkbox"
          ? input.checked
          : type === "number"
            ? Number(input.value)
            : input.value.trim());
    field(parent, label, input);
  }
  function draw() {
    panel.replaceChildren(el("h3", "خيارات الوجبة"));
    for (const g of groups) {
      const box = el("fieldset");
      control(box, g, "label", "اسم المجموعة (مثل الحجم)");
      control(box, g, "en", "الاسم بالإنجليزية");
      control(box, g, "required", "اختيار مطلوب", "checkbox");
      control(box, g, "multiple", "السماح بأكثر من اختيار", "checkbox");
      for (const o of g.choices) {
        const row = el("fieldset");
        control(row, o, "label", "الخيار");
        control(row, o, "en", "بالإنجليزية");
        control(row, o, "price", "زيادة السعر بالشيكل", "number");
        control(row, o, "available", "متاح", "checkbox");
        row.append(
          button("حذف الخيار", () => {
            g.choices.splice(g.choices.indexOf(o), 1);
            draw();
          }),
        );
        box.append(row);
      }
      box.append(
        button("إضافة خيار", () => {
          g.choices.push({
            id: crypto.randomUUID(),
            label: "",
            price: 0,
            available: true,
          });
          draw();
        }),
        button("حذف المجموعة", () => {
          groups.splice(groups.indexOf(g), 1);
          draw();
        }),
      );
      panel.append(box);
    }
    panel.append(
      button("إضافة مجموعة خيارات", () => {
        groups.push({
          label: "",
          choices: [],
          required: false,
          multiple: false,
        });
        draw();
      }),
    );
  }
  draw();
  return () => {
    if (
      groups.some(
        (g) =>
          !g.label ||
          !g.choices.length ||
          g.choices.some(
            (o) => !o.label || !Number.isFinite(o.price) || o.price < 0,
          ),
      )
    )
      throw Error("أكمل أسماء الخيارات وأسعارها");
    return groups;
  };
}
