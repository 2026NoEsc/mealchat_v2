// Every Edge unit-test VM denies network by default. Inject a mock explicitly.
import vm from 'node:vm';
export function denyNetworkFetch() { throw new Error('EDGE_TEST_NETWORK_DISABLED'); }
export function runEdgeVm(code,globals={}) {
 if(globals.fetch===globalThis.fetch)throw new Error('EDGE_TEST_HOST_FETCH_FORBIDDEN');
 return vm.runInNewContext(code,{fetch:denyNetworkFetch,...globals});
}
