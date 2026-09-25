(function () {
  const ITEMS = [
    {
      id: "create",
      title: "Create Content",
      summary: "Create new content items in Sitefinity Dynamic Modules from JSON definitions."
    },
    {
      id: "update",
      title: "Update Content",
      summary: "Modify existing content items by updating their values through JSON."
    },
    {
      id: "insert",
      title: "Insert Content",
      summary: "Inject JSON-defined data into existing dynamic module structures."
    },
    {
      id: "bulk",
      title: "Bulk Content Management",
      summary: "Create or update multiple content items in a single operation using JSON files."
    },
    {
      id: "modules",
      title: "Dynamic Module Support",
      summary: "Work with Sitefinity Dynamic Modules and their custom fields."
    },
    {
      id: "mapping",
      title: "Field Mapping",
      summary: "Map JSON properties to the corresponding fields in Sitefinity Dynamic Modules."
    },
    {
      id: "identify",
      title: "Content Identification",
      summary: "Identify existing items with a configured identifier so the tool can create or update."
    },
    {
      id: "validate",
      title: "Validation",
      summary: "Validate JSON structures and required fields before applying changes."
    },
    {
      id: "logging",
      title: "Error Handling and Logging",
      summary: "Report successful operations, validation errors, and failed content updates."
    },
    {
      id: "templates",
      title: "Reusable JSON Templates",
      summary: "Keep reusable JSON files for consistent content creation and updates."
    }
  ];

  const list = document.getElementById("menu-list");
  const kicker = document.getElementById("menu-detail-kicker");
  const title = document.getElementById("menu-detail-title");
  const body = document.getElementById("menu-detail-body");

  function select(id) {
    const item = ITEMS.find((entry) => entry.id === id) || ITEMS[0];
    list.querySelectorAll(".menu-item").forEach((button) => {
      const selected = button.dataset.id === item.id;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-selected", selected ? "true" : "false");
    });
    kicker.textContent = "Capability";
    title.textContent = item.title;
    body.textContent = item.summary;
  }

  ITEMS.forEach((item, index) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-item";
    button.dataset.id = item.id;
    button.setAttribute("role", "option");
    button.innerHTML = `<span class="menu-item__index">${String(index + 1).padStart(2, "0")}</span><span class="menu-item__title"></span>`;
    button.querySelector(".menu-item__title").textContent = item.title;
    button.addEventListener("click", () => select(item.id));
    li.appendChild(button);
    list.appendChild(li);
  });

  select(ITEMS[0].id);
})();
