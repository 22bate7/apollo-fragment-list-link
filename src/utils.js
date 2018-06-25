import _uniqBy from 'lodash/uniqBy';

import { toIdValue } from 'apollo-utilities';

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

export const processArgs = (result, { args } = {}, { operators } = {}) => {
  const output = { ...result, nodes: [...result.nodes] };
  const applyOperator = createApplyOperator(operators);

  Object.keys(args || {}).forEach(key => {
    const argInput = args[key];
    const nodes = output.nodes;

    switch (key) {
      case 'filter': {
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
