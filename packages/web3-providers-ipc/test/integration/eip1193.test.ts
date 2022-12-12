/*
This file is part of web3.js.

web3.js is free software: you can redistribute it and/or modify
it under the terms of the GNU Lesser General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

web3.js is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License
along with web3.js.  If not, see <http://www.gnu.org/licenses/>.
*/

import { hexToNumber } from 'web3-utils';
import {
	HexString,
	ProviderConnectInfo,
	ProviderRpcError,
	Web3ProviderEventCallback,
} from 'web3-types';
import IpcProvider from '../../src/index';

import { getSystemTestProvider, describeIf, isIpc } from '../fixtures/system_test_utils';
import { waitForCloseConnection, waitForOpenConnection } from '../fixtures/helpers';

describeIf(isIpc)('IpcProvider - eip1193', () => {
	let socketPath: string;
	let socketProvider: IpcProvider;

	beforeAll(() => {
		socketPath = getSystemTestProvider();
	});
	beforeEach(() => {
		socketProvider = new IpcProvider(socketPath);
	});
	afterEach(async () => {
		socketProvider.disconnect(1000);
		await waitForCloseConnection(socketProvider);
	});

	describe('check events', () => {
		it('should send connect event', async () => {
			const { chainId } = await new Promise(resolve => {
				socketProvider.on('connect', ((_error: unknown, data) => {
					resolve(data as unknown as ProviderConnectInfo);
				}) as Web3ProviderEventCallback<ProviderConnectInfo>);
			});
			expect(hexToNumber(chainId)).toBeGreaterThan(0);
		});

		it('should send disconnect event', async () => {
			await waitForOpenConnection(socketProvider);
			const disconnectPromise = new Promise<ProviderRpcError>(resolve => {
				socketProvider.on('disconnect', ((error: ProviderRpcError) => {
					resolve(error);
				}) as Web3ProviderEventCallback<ProviderRpcError>);
			});
			socketProvider.disconnect(1000, 'Some extra data');

			const err = await disconnectPromise;
			expect(err.code).toBe(1000);
			expect(err.data).toBe('Some extra data');
		});
		it('should send chainChanged event', async () => {
			await waitForOpenConnection(socketProvider);
			// @ts-expect-error set private variable
			socketProvider._chainId = '0x1';
			socketProvider.disconnect(1000);
			await waitForCloseConnection(socketProvider);
			const chainChangedPromise = new Promise<ProviderConnectInfo>(resolve => {
				socketProvider.on('chainChanged', ((_error, data) => {
					resolve(data as unknown as ProviderConnectInfo);
				}) as Web3ProviderEventCallback<ProviderConnectInfo>);
			});
			socketProvider.connect();
			await waitForOpenConnection(socketProvider);
			const changedData = await chainChangedPromise;
			expect(changedData.chainId).not.toBe('0x1');
			expect(hexToNumber(changedData.chainId)).toBeGreaterThan(0);
		});
		it('should send accountsChanged event', async () => {
			await waitForOpenConnection(socketProvider);

			// @ts-expect-error set private variable
			socketProvider._accounts = ['1', '2'];
			socketProvider.disconnect(1000);
			await waitForCloseConnection(socketProvider);
			const chainChangedPromise = new Promise<{ accounts: HexString[] }>(resolve => {
				socketProvider.on('accountsChanged', ((_error, data) => {
					resolve(data as unknown as { accounts: HexString[] });
				}) as Web3ProviderEventCallback<{ accounts: HexString[] }>);
			});
			socketProvider.connect();
			await waitForOpenConnection(socketProvider);
			const changedData = await chainChangedPromise;

			expect(JSON.stringify(changedData.accounts)).not.toBe(JSON.stringify(['1', '2']));
		});
	});
});
