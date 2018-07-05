# [apollo-fragment-list-link](https://github.com/22bate7/apollo-fragment-list-link)

### Link to Read your all local fragments with Apollo Client!

<h2>Problem</h2>

Apollo Client cache is your single source of truth that holds all of your local data alongside your remote data. But in case of parameterized queries [apollo-cache-inmemory]() it usually very difficult to retrieve client-side data due to stringify key approach in the cache. So [apollo-fragment-list-link]() is the link to read all your client-side fragments with the help of apollo-link-state's `@client` directive. It can be used as afterware of [apollo-http-link](), It will find all updated fragments and will put them in the cache with customizable cache key. apollo has introduced `@connection` directive, with help of it, you can control the key of caching, but in case of a different query containing different filtering parameters, it will be very difficult to read all local fragments which we have already fetched. Suppose we have implemented suggestions query, and have already fetched suggestions with some prefix token, Now we want to read all suggestions offline from the cache,

Suppose we have implemented suggestions query, and have already fetched suggestions with some prefix token, Now we want to read all suggestions offline from the cache, 

```js
query fetchSuggestion($token: String!) {
  suggestions(condition:{$startWith:$token}) {
      ...SuggestionItem
  }
}
fragment SuggestionItem on Suggestion {
  id
  name
  label
}
```

 First query variables:

```json
{"token": "Exa"}
```

Second query variables:

```json
{"token": "To"}
```

After queries listed above, partial cache status will be 

#### Before

(without apollo-fragment-list-link)

```js
{
    $ROOT_QUERY.fetchSuggestion.(token:"Exa"): [...],
    $ROOT_QUERY.fetchSuggestion.(token:"To"): [...],
  	Suggestion:1,
  	Suggestion:2,
	....
}
```

#### After

(with apollo-fragment-list-link)

```js
{
	$ROOT_QUERY.allSuggestions: {
	  totalCount
      nodes: [
       	{id: "Suggestion:1"},
        {id: "Suggestion:2"},
        ...
      ]
	},
    $ROOT_QUERY.fetchSuggestion.(token:"Exa"): [...],
    $ROOT_QUERY.fetchSuggestion.(token:"To"): [...],
  	Suggestion:1,
  	Suggestion:2,
	....
}
```

```js
const query = gql`
	query clientSuggestions {
		allSuggestions @client {
  			nodes {
  				id
			}
		}
	}
}
`;
const {result} = await client.query({
  query,
})
/*
result = [{id:1,__typename:"Suggestion"}, {id:2,__typename:"Suggestion"}, ...] 
*/
```

<h2 id="start">Quick start</h2>

To get started, install `apollo-fragment-list-link` from npm:

```bash
npm install apollo-fragment-list-link --save
```

#### Setup

```js
import { withClientState } from 'apollo-link-state';
import ApolloFragmentLink from 'apollo-fragment-list-link';

// This is the same cache you pass into new ApolloClient
const cache = new InMemoryCache(...);
                                
const fragmentLink = new ApolloFragmentLink({
  cache,
  fragmentTypeDefs: [
    gql`
      fragment SuggestionItem on Suggestion {
		id
		name
	  }
    `,
  ],
  // @optional
  createCacheReadKey: ({typename}) => `all${typename}`,
  // @optional 
  createConnectionTypename: ({typename}) => `All${typename}Connection`,
});

const stateLink = withClientState({
  cache,
  resolvers: {
    Query: {
     	...fragmentLink.createStateLinkQueryResolvers()
    },
  }
});

const link = stateLink.concat(fragmentLink.concat(httpLink));

export const client = new ApolloClient({
  link,
  cache,
});

```

#### Usage

```js
const GET_SUGGESTIONS = gql`
	query clientSuggestions {
		allSuggestions @client {
  			nodes {
  				id
			}
		}
	}
}
`;
const {result} = await client.query({
  query: GET_SUGGESTIONS,
})
```

<h2 id="local-development">Local Development</h2>

Finally, each time you make a change in apollo-link-state, you need to run:

```shell
yarn bundle
```

Now you should be good to go!
