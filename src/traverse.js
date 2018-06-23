import {
  isInlineFragment,
  shouldInclude,
  isField,
  resultKeyNameFromField,
  toIdValue
} from "apollo-utilities";

function traverseSelections(
  selectionSet = {},
  result = {},
  { fragmentMap, variables = {}, context = {}, output = {} } = {}
) {
  const staticContextArgs = { fragmentMap, variables, context, output };

  (selectionSet.selections || []).forEach(selection => {
    //TODO use
    const checkIfShouldInclude = shouldInclude(selection, variables);
    if (!checkIfShouldInclude) {
      return;
    }
    if (isField(selection)) {
      const resultFieldKey = resultKeyNameFromField(selection);
      const field = selection;
      const value = result[resultFieldKey];

      const isScalar = !field.selectionSet || value === null;
      const isArray = Array.isArray(value);
      const isObject = !isScalar && !isArray;

      if (selection.selectionSet) {
        if (isArray) {
          value.forEach(item => {
            traverseSelections(selection.selectionSet, item, staticContextArgs);
          });
        } else {
          traverseSelections(selection.selectionSet, value, staticContextArgs);
        }
      }

      const cacheKey = context.getCacheKey(value);
      if (isObject && cacheKey) {
        //
        const typename = value.__typename;
        if (!output[typename]) {
          output[typename] = {};
        }
        output[typename][cacheKey] = toIdValue(
          {
            id: value.id,
            __typename: typename
          },
          true
        );
      }
    } else {
      const fragment = getFragment(selection, fragmentMap);
      traverseSelections(fragment.selectionSet, result, staticContextArgs);
    }
  });
}
/**
 * NOTE apollo-cache-inmemory/src/writeToStore.ts -> writeSelectionSetToStore function
 * @param {*} selection
 * @param {*} fragmentMap
 * @returns fragment
 */
function getFragment(selection, fragmentMap) {
  if (isInlineFragment(selection)) {
    return selection;
  } else {
    // Named fragment
    return (fragmentMap || {})[selection.name.value];

    if (!fragment) {
      throw new Error(`No fragment named ${selection.name.value}.`);
    }
  }
}

export default traverseSelections;