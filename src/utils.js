import _uniqBy from 'lodash/uniqBy';
import _get from 'lodash/get';

import { toIdValue, getFragmentDefinition } from 'apollo-utilities';

export function iterateOnTypename({
  createLocalCacheKey,
  resolvedFragmentIds = [],
  initial = {},
  getValueOnTypename = () => {},
  createConnectionTypename,
}) {
  return resolvedFragmentIds.reduce((accum, typename) => {
    const localCacheKey = createLocalCacheKey({ typename });
    const nodes = _uniqBy(
      [
        ...((accum[localCacheKey] || {}).nodes || []),
        ...getValueOnTypename({ typename, localCacheKey }),
      ],
      ({ id }) => id,
    );
    return {
      ...accum,
      ...{
        [localCacheKey]: {
          nodes,
          totalCount: nodes.length,
          __typename: createConnectionTypename({ typename }),
        },
      },
    };
  }, initial);
}

export function createCachableFragmentMap(fragmentTypeDefs) {
  return fragmentTypeDefs.reduce((accum, fragmentTypeDef) => {
    const fragmentDefinition = getFragmentDefinition(fragmentTypeDef);
    const typename = fragmentDefinition.typeCondition.name.value;
    return { ...accum, ...{ [typename]: fragmentTypeDef } };
  }, {});
}

export function createTransformerCacheIdValueNode(cache, typename) {
  return node => {
    const value = cache.data.get(node.id);
    return toIdValue(
      {
        id: value.id,
        __typename: typename,
      },
      true,
    );
  };
}

function createApplyOperator(operators) {
  return (operand, operator, value) => {
    const operation = operators[operator];
    if (!operation) {
      return false;
    }
    return operation(operand, value);
  };
}

const filteringResult = (nodes, ite = () => {}) => {
  const resultNodes = (nodes || []).filter(ite);
  return {
    nodes: resultNodes,
    totalCount: resultNodes.length,
  };
};

const SORT_PARAMS = {
  ASC: 1,
  DESC: -1,
};

function sortResultNodes(nodes, argInput) {
  const params = (argInput || '').split('__');
  const [sortParam] = params.splice(-1);
  if (
    params.length < 1 ||
    !sortParam ||
    !Object.keys(SORT_PARAMS).find(p => p === sortParam)
  ) {
    return nodes;
  }
  const fieldParamKey = [...params].join('__');

  if (!fieldParamKey || !sortParam) {
    return nodes;
  }
  return (nodes || []).sort((item = {}, comparator = {}) => {
    const fieldToSort = item[fieldParamKey];
    const fieldToCompare = comparator[fieldParamKey];
    const direction = SORT_PARAMS[sortParam];

    if (
      (typeof fieldToSort === typeof 0) &
      (typeof fieldToCompare === typeof 0)
    ) {
      return fieldToSort * direction - fieldToCompare * direction;
    } else if (
      !isNaN(Date.parse(fieldToSort)) &&
      !isNaN(Date.parse(fieldToCompare))
    ) {
      return (
        Date.parse(fieldToSort) * direction -
        Date.parse(fieldToCompare) * direction
      );
    }
    return 0;
  });
}

export const processArgs = (result, { info } = {}, { operators } = {}) => {
  const filterDirective = _get(info, ['directives', 'filter']);
  if (!filterDirective) {
    return result;
  }
  const output = { ...result, nodes: [...result.nodes] };
  const applyOperator = createApplyOperator(operators);

  Object.keys(filterDirective || {}).forEach(key => {
    const argInput = filterDirective[key];
    const nodes = output.nodes;

    switch (key) {
      case 'with': {
        Object.assign(
          output,
          filteringResult(nodes, item => {
            return Object.keys(argInput).every(argInputKey => {
              const [fieldKey, operator] = [
                ...argInputKey.split('__'),
                null,
                null,
              ];
              if (!operator || !fieldKey) {
                return false;
              }
              return applyOperator(
                item[fieldKey],
                operator,
                argInput[argInputKey],
              );
            });
          }),
        );
        break;
      }
      case 'match': {
        Object.assign(
          output,
          filteringResult(nodes, item => {
            return Object.keys(argInput).every(argInputKey =>
              new RegExp(argInput[argInputKey] || '').test(item[argInputKey]),
            );
          }),
        );
        break;
      }
      case 'orderBy': {
        if (typeof argInput !== typeof '') {
          break;
        }
        const sortedNodes = sortResultNodes(nodes, argInput);

        Object.assign(output, {
          nodes: sortedNodes,
          totalCount: sortedNodes.length,
        });
        break;
      }
      case 'condition': {
        Object.assign(
          output,
          filteringResult(nodes, item => {
            return Object.keys(argInput).every(
              argInputKey => item[argInputKey] === argInput[argInputKey],
            );
          }),
        );
        break;
      }
      default:
        break;
    }
  });

  return output;
};
