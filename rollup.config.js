import resolve from 'rollup-plugin-local-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import babel from 'rollup-plugin-babel';

const globals = {};

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/bundle.umd.js',
    format: 'umd',
    name: 'apollo-fragment-list-link',
    exports: 'named',
    sourcemap: true,
    globals,
  },
  external: Object.keys(globals),
  onwarn,
  plugins: [
    resolve(),
    sourcemaps(),
    babel(),
  ],
};

function onwarn(message) {
  const suppressed = ['UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'];

  if (!suppressed.find(code => message.code === code)) {
    return console.warn(message.message);
  }
}
