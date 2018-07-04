import _upperFirst from 'lodash/upperFirst';
import _merge from 'lodash/merge';
import _reduce from 'lodash/reduce';
import _castArray from 'lodash/castArray';
import _isArray from 'lodash/isArray';
import _get from 'lodash/get';

import CacheQueryLink from './CacheQueryLink';
import FilterDirectiveLink from './FilterDirectiveLink';
import { withClientState } from 'apollo-link-state';

function createJoinKey({ cacheQueryLink, typename, joinKey } = {}) {
  return `${cacheQueryLink.createLocalCacheKey({
    typename,
  })}By${joinKey}`;
}

function createArrayJoinConnection({
  cacheQueryLink,
  typename,
  joinItem = {},
} = {}) {
  return (data = {}) => {
    const result = cacheQueryLink.readNodesOnType(typename);
    const joinField = joinItem.field;
    const nodes = _get(result, ['nodes'], {}).filter(resultNode => {
      return _get(resultNode, [joinField]) === _get(data, [joinField]);
    });
    return {
      ...result,
      nodes,
      totalCount: nodes.length,
    };
  };
}

export function createCacheQueryLink({
  stateLinkConfig,
  filterOperatorDirectives,
  joinConnection = {},
  ...config
}) {
  const cache = stateLinkConfig.cache;

  const cacheQueryLink = new CacheQueryLink({ cache, ...config });
  const filterDirectiveLink = new FilterDirectiveLink({
    filterOperatorDirectives,
  });

  const stateLink = withClientState({
    ...stateLinkConfig,
    resolvers: _merge(stateLinkConfig.resolvers, {
      Query: cacheQueryLink.createStateLinkResolvers(),
      ..._reduce(
        joinConnection,
        (accum, nodes, key) => {
          //
          return {
            ...accum,
            [key]: _castArray(nodes).reduce((nodeAccum, item) => {
              const joinKey = _upperFirst(item.field);
              const typename = item.typename;

              const resolverKey = createJoinKey({
                cacheQueryLink,
                typename: _isArray(typename) ? typename[0] : typename,
                joinKey,
              });

              if (_isArray(typename) && typename.length === 1) {
                return {
                  ...nodeAccum,
                  [resolverKey]: createArrayJoinConnection({
                    cacheQueryLink,
                    typename: typename[0],
                    joinItem: item,
                  }),
                };
              } else if (_isArray(typename)) {
                return nodeAccum;
              }

              const fragment = cacheQueryLink.getFragmentByTypename(typename);
              if (!fragment) {
                return nodeAccum;
              }
              return {
                ...nodeAccum,
                [resolverKey]: (data = {}) =>
                  cache.readFragment({
                    id: `${typename}:${data[item.field]}`,
                    fragment,
                  }),
              };
            }, {}),
          };
          //
        },
        {},
      ),
    }),
  });

  return filterDirectiveLink.concat(stateLink.concat(cacheQueryLink));
}
