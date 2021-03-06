import _upperFirst from 'lodash/upperFirst';
import _merge from 'lodash/merge';
import _reduce from 'lodash/reduce';
import _castArray from 'lodash/castArray';
import _isArray from 'lodash/isArray';
import _get from 'lodash/get';

import CacheQueryLink from './CacheQueryLink';
import WithFilterDirectiveLink from './WithFilterDirectiveLink';
import { withClientState } from 'apollo-link-state';

function createJoinKey({ cacheQueryLink, typename, joinKey } = {}) {
  return `${cacheQueryLink.createCacheReadKey({
    typename,
  })}By${joinKey}`;
}

const DEFAULT_OPERATORS = {
  eq: (operand, value) => operand === value,
  lt: (operand, value) => operand < value,
  gt: (operand, value) => operand > value,
  lte: (operand, value) => operand <= value,
  gte: (operand, value) => operand >= value,
};


export function createCacheQueryLink({
  stateLinkConfig,
  filterOperatorDirectives  = DEFAULT_OPERATORS,
  joinConnection = {},
  ...config
}) {
  const cache = stateLinkConfig.cache;

  const cacheQueryLink = new CacheQueryLink({
    cache,
    filterOperatorDirectives,
    ...config,
  });
  const filterDirectiveLink = new WithFilterDirectiveLink({
    filterOperatorDirectives,
  });

  const stateLink = withClientState({
    ...stateLinkConfig,
    resolvers: _merge(stateLinkConfig.resolvers, {
      Mutation: cacheQueryLink.createStateLinkMutationResolvers(),
      Query: cacheQueryLink.createStateLinkQueryResolvers(),
      ..._reduce(
        joinConnection,
        (accum, nodes, key) => {
          //
          return {
            ...accum,
            [key]: _castArray(nodes).reduce((nodeAccum, items) => {
              return _castArray(items).reduce((itemAccum, item) => {
                const joinKey = _upperFirst(item.field);
                const typename = item.typename;

                const resolverKey = createJoinKey({
                  cacheQueryLink,
                  typename: _isArray(typename) ? typename[0] : typename,
                  joinKey,
                });

                if (_isArray(typename) && typename.length === 1) {
                  return {
                    ...itemAccum,
                    [resolverKey]: cacheQueryLink.createArrayJoinConnection({
                      typename: typename[0],
                      joinItem: item,
                    }),
                  };
                } else if (_isArray(typename)) {
                  return itemAccum;
                }

                const fragment = cacheQueryLink.getFragmentByTypename(typename);
                if (!fragment) {
                  return itemAccum;
                }
                return {
                  ...itemAccum,
                  [resolverKey]: (data = {}) =>
                    cache.readFragment({
                      id: `${typename}:${data[item.field]}`,
                      fragment,
                    }),
                };
              }, nodeAccum);
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
