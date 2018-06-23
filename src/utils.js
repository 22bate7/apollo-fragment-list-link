import _uniqBy from "lodash/uniqBy";

import { toIdValue } from "apollo-utilities";

export function iterateOnTypename({
  createLocalCacheKey,
  resolvedFragmentIds = [],
  initial = {},
  getValueOnTypename = () => {},
  createConnectionTypename
}) {
  return resolvedFragmentIds.reduce((accum, typename) => {
    const localCacheKey = createLocalCacheKey({ typename });
    const nodes = _uniqBy(
      [
        ...((accum[localCacheKey] || {}).nodes || []),
        ...getValueOnTypename({ typename, localCacheKey })
      ],
      ({ id }) => id
    );
    return {
      ...accum,
      ...{
        [localCacheKey]: {
          nodes,
          totalCount: nodes.length,
          __typename: createConnectionTypename({ typename })
        }
      }
    };
  }, initial);
}

export function createTransformerCacheIdValueNode(cache, typename) {
  return node => {
    const value = cache.data.get(node.id);
    return toIdValue(
      {
        id: value.id,
        __typename: typename
      },
      true
    );
  };
}
