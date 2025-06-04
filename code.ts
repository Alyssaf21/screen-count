var newName = "";
var nameList: string[] = [];
var nodes: SceneNode[] = [];
var filterednodes: SceneNode[] = [];
var alphabeticalLabel = false;
var appendLabel = false;
var flowDiagram = false;
var diagramArray = Array.from(Array(2), () => new Array(4));

function convertToLetter(n: number) {
  if (n < 27) { let letter = (n + 9).toString(36).toUpperCase(); return letter; }
  else { let letterWrap = n - 26; return convertToLetter(letterWrap); }
}

function checkNames(n: String) { for (const name in nameList) { if (n == nameList[name]) { return true; } } return false; }

function resetArrays() { nodes = []; filterednodes = []; }

function selectionFilters(n: SceneNode) { // Finds frames/instances with a listed name & pushes it to nodes[]
  if ((n.type === "FRAME" || n.type === "INSTANCE") && n.children) {
    if (checkNames(n.name)) { nodes.push(n); }
    else { for (const c of n.children) { selectionFilters(c); } }
  }
}

function nodeFilters(n: SceneNode) { // Finds first text child in node and pushes it to filteredNodes[]
  if ((n.type === "FRAME" || n.type === "INSTANCE") && n.children) {
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

// function uniq(a) {
//     return a.filter(function(item, pos, ary) {
//         return !pos || item != ary[pos - 1];
//     });
// }

function diagramSort() {
  // dilemma- we need a sort function, but I also want to grab anything in a column (x is same, y is different) and throw them in a different array, which itself is sorted...
  // currently trying to first run the normal sort, then 
  let uniqueXVals = []; //FIND ALL WITH SAME X VALUES
  // Find all possible X values, then find out which ones share them
  
  for (let x = 0; x < (nodes.length - 1); x++) {
    let currentNode = nodes[x].x;
    console.log(currentNode);

    uniqueXVals.push(currentNode);
    // if(!uniqueXVals.find(currentNode)){}
    // for(let v = 1; v < (uniqueXVals.length - 1); v++){
    //   if(uniqueXVals[x].x == uniqueXVals[v].x) {
    //     console.log("Found matching values!");
    //     console.log(uniqueXVals[v]);
    //   }
    // }
    // const transformA = nodes[x].absoluteTransform as Transform;
    // const ax = transformA[0][2];
    // // const ay = transformA[1][2];
    // const transformB = nodes[x + 1].absoluteTransform as Transform;
    // const bx = transformB[0][2];
    // // const by = transformB[1][2];
    // // console.log(ax + " | " + bx);

    // if (ax == bx) {
    //   console.log(nodes[x] + " horizontal matches " + nodes[x]);
    //   // if (diagramArray.length < 1) {
    //   //   diagramArray.push([a, b]);
    //   // } else {
    //   //   for (let i = 0; i < diagramArray.length; i++) {
    //   //     if (diagramArray[i].find(a)) { diagramArray[i].push(b); }
    //   //     else if (diagramArray[i].find(b)) { diagramArray[i].push(a); }
    //   //     else { diagramArray.push([a, b]); }
    //   //   }
    //   // }
    // }
  }
}

const setNameList = async () => { nameList = await figma.clientStorage.getAsync("FrameNames"); }

const checkSelection = async () => { // Filters initial selection for frames and instances that meet requirements
  setNameList();
  if (figma.currentPage.selection.length < 1) { figma.ui.postMessage(false); }
  for (const n of figma.currentPage.selection) { selectionFilters(n); }
  // diagramSort(); //console.log(diagramArray);
  nodes.sort(positionSort);
  for (const n of nodes) { nodeFilters(n); }

  console.log(nodes);
  console.log(filterednodes);

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
        }
        // node.characters = (1 * count).toString().padStart(2, '0'); //replace with 01..
      }
    }
    figma.notify("Screen labels have been renumbered!");
    figma.commitUndo();
  }
}

const clearClientStorage = async () => {
  nameList = [];
  await figma.clientStorage.setAsync("FrameNames", [])
  figma.ui.postMessage(await figma.clientStorage.getAsync("FrameNames"));
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