const {search} = require('language-tags');

function sumRange(n) {
  let total = 0;

  for (let i = n; i > 0; i--) {
    total += i;
  }

  return total;
}

console.log(sumRange(3));

function sumRangeRecursive(n, total = 0) {
  if (n <= 0) {
    return total;
  }

  return sumRangeRecursive(n - 1, total + n);
}

console.log(sumRangeRecursive(3));

function printChildren(tree, children = []) {
  for (const child of tree.children) {
    children.push(child.name);
    printChildren(child, children);
  }

  return children;
}

const tree = {
  name: 'John',
  children: [
    {name: 'Jim', children: []},
    {name: 'Zoe',
      children: [
        {name: 'Jane', children: []},
        {name: 'Kyle', children: [
          {name: 'Brad', children: []},
          {name: 'Chad', children: []},
        ]},
      ],
    },
  ],
};

console.log(printChildren(tree));

function searchTree(t, searchTerm) {
  if (t.name === searchTerm) return t;

  for (const child of t.children) {
    const value = searchTree(child, searchTerm);
    if (value) return value;
  }
}

console.log(searchTree(tree, 'Chad'));

function getParent(t, searchTerm, parent) {
  if (t.name === searchTerm) {
    return parent;
  }

  for (const child of t.children) {
    const value = getParent(child, searchTerm, t);
    if (value) return value;
  }
}

console.log(getParent(tree, 'Chad'));

/**
 * Flatten an array which contains arrays.
 * @param {*[]} arr - Array containing arrays
 * @param {*[]} result - Array to store non-array values
 * @return {*[]} Flattened array
 */
function flattenArray(arr, result = []) {
  for (const item of arr) {
    if (Array.isArray(item)) flattenArray(item, result);
    else result.push(item);
  }

  return result;
}

const arrays = [
  [1, 2, 3, [4, 5]],
  [6, 7, 8, [9, [10]]],
];

console.log(flattenArray(arrays));
