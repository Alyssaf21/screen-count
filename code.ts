var newName = "";
var nameList: string[] = [];
var nodes: SceneNode[] = [];
var filterednodes: SceneNode[] = [];
var alphabeticalLabel = false;
var appendLabel = false;

const setNameList = async () => {
  nameList = await figma.clientStorage.getAsync("FrameNames"); 
  if (nameList == undefined) { // Sets up client storage for first-time plugin users
    await figma.clientStorage.setAsync("FrameNames", []);
    nameList = [];
  }
}

function convertToLetter(n: number) {
  if (n < 27) { let letter = (n + 9).toString(36).toUpperCase(); return letter; }
  else { let letterWrap = n - 26; return convertToLetter(letterWrap); }
}

function checkNames(n: String) { for (const name in nameList) { if (n == nameList[name]) { return true; } } return false; }

function resetArrays() { nodes = []; filterednodes = []; }

function selectionFilters(n: SceneNode) { // Finds frames/instances with a listed name & pushes it to nodes[]
  if ((n.type === "FRAME" || n.type === "INSTANCE" || n.type === "SECTION") && n.children) {
    if (checkNames(n.name)) { nodes.push(n); }
    else { for (const c of n.children) { selectionFilters(c); } }
  }
}

function nodeFilters(n: SceneNode) { // Finds first text child in node and pushes it to filteredNodes[]
  if ((n.type === "FRAME" || n.type === "INSTANCE" || n.type === "SECTION") && n.children) {
    let firstTextChild = n.findOne(x => x.type === "TEXT" && x.visible);
    if (firstTextChild != null) { filterednodes.push(firstTextChild); }
  }
}

function positionSort(a: any, b: any) { // evalutates which node is either above or left of the other using each node's position relative to the page.
  const transformA = a.absoluteTransform as Transform;
  const ax = transformA[0][2];
  const ay = transformA[1][2];
  const transformB = b.absoluteTransform as Transform;
  const bx = transformB[0][2];
  const by = transformB[1][2];

  if (ay > by) { return 1; }
  else if (ay < by) { return -1; }
  else if (ax > bx) { return 1; }
  else if (ax < bx) { return -1; }
  return 0;
}

const checkSelection = async () => { // Filters initial selection for frames and instances that meet requirements
  setNameList();
  // Checks to make sure something has been selected first
  if (figma.currentPage.selection.length < 1) { figma.ui.postMessage("None Selected"); }
  else {
    for (const n of figma.currentPage.selection) { selectionFilters(n); }
    nodes.sort(positionSort);
    for (const n of nodes) { nodeFilters(n); }

    if (filterednodes.length > 0) {
      let count = 0;
      for (let node of filterednodes) {
        count++;
        if (node.type === "TEXT") {
          await Promise.all(node.getRangeAllFontNames(0, node.characters.length).map(figma.loadFontAsync)); // Loads fonts to be used
          if (appendLabel) {
            if (alphabeticalLabel) { node.characters = node.characters + convertToLetter(1 * count); }
            else { node.characters = node.characters + (1 * count).toString(); /*replace with original string + 1..*/ }
          }
          else if (alphabeticalLabel) {
            node.characters = convertToLetter(1 * count) + "";
          } else {
            node.characters = (1 * count).toString(); /*replaces with 1..*/
            // node.characters = (1 * count).toString().padStart(2, '0'); //replace with 01..
          }
        }
      }
      figma.notify("Screen labels have been renumbered!");
      figma.ui.postMessage("Complete");
      figma.commitUndo();
    } else {
      figma.ui.postMessage("None Found"); // No nodes match the provided label names
      figma.notify("No matching labels found. Please check layer names.");
    }
  }
}

const clearClientStorage = async () => {
  nameList = [];
  await figma.clientStorage.setAsync("FrameNames", []);
  figma.ui.postMessage("Names Cleared");
}

const addNewName = async () => {
  nameList.push(newName);
  await figma.clientStorage.setAsync("FrameNames", nameList);
}

setNameList().then(() => {
  console.clear();
  figma.showUI(__html__, { themeColors: true, width: 400, height: 500 });
  figma.ui.postMessage(nameList);
});

figma.ui.onmessage = (msg: { type: string, name: string, alphabetical: boolean, append: boolean }) => {
  if (msg.alphabetical == true) { alphabeticalLabel = true; } else { alphabeticalLabel = false; }
  if (msg.append == true) { appendLabel = true; } else { appendLabel = false; }
  if (msg.type === 'add-name') { newName = msg.name; addNewName().then(() => { figma.ui.postMessage(nameList); }); }
  if (msg.type === 'renumber') { resetArrays(); checkSelection(); };
  if (msg.type === 'clear') { clearClientStorage(); }
  if (msg.type === 'cancel') { figma.closePlugin(); }
};