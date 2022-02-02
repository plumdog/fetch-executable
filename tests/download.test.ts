import { downloadExecutable, Options } from '..';
import * as tmp from 'tmp';
import * as pathlib from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Readable } from 'stream';
import axios from 'axios';
import MockAxiosAdapter from 'axios-mock-adapter';

const mockAxios = new MockAxiosAdapter(axios, {
    onNoMatch: 'throwException',
});

tmp.setGracefulCleanup();

afterEach(() => {
    mockAxios.reset();
});

const createBody = (body: string): NodeJS.ReadableStream => {
    const buffer = Buffer.from(body, 'utf8');
    const readable = new Readable();
    readable._read = () => {
        // _read is required but you can noop it
    };
    readable.push(buffer);
    readable.push(null);
    return readable;
};

const sampleExecutableFileContent = ['#!/bin/bash', '', 'echo 1.2.3', ''].join('\n');

describe('downloads', () => {
    test('can download file', async () => {
        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(sampleExecutableFileContent));

        const options = new Options({
            url: 'http://example.com/testexc_version_1.2.3',
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            execIsOk: async (filepath: string): Promise<boolean> => false,
        });

        await downloadExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            options,
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);
        expect(execSync(pathlib.join(dir.name, 'testexc'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does not download file if already the right version', async () => {
        const dir = tmp.dirSync();

        fs.writeFileSync(pathlib.join(dir.name, 'testexc'), 'anyfile');

        await downloadExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            options: new Options({
                url: 'http://example.com/testexc_version_1.2.3',
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                execIsOk: async (filepath: string): Promise<boolean> => true,
            }),
        });

        expect(mockAxios.history.get).toEqual([]);

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual('anyfile');

        fs.rmdirSync(dir.name, { recursive: true });
    });

    test('does download file if the wrong version', async () => {
        const dir = tmp.dirSync();

        fs.writeFileSync(pathlib.join(dir.name, 'testexc'), 'oldfile');

        mockAxios.onGet().reply(200, createBody('newfile'));

        await downloadExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            options: new Options({
                url: 'http://example.com/testexc_version_1.2.3',
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                execIsOk: async (filepath: string): Promise<boolean> => Promise.resolve(false),
            }),
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual('newfile');

        fs.rmdirSync(dir.name, { recursive: true });
    });
});

describe('downloads using version shortcut', () => {
    test('can download file by version shortcut', async () => {
        const dir = tmp.dirSync();

        mockAxios.onGet().reply(200, createBody(sampleExecutableFileContent));

        await downloadExecutable({
            target: pathlib.join(dir.name, 'testexc'),
            options: Options.version({
                version: '1.2.3',
                url: 'http://example.com/testexc_version_{version}',
                versionExecArgs: [],
            }),
        });

        expect(fs.readFileSync(pathlib.join(dir.name, 'testexc'), 'utf8')).toEqual(sampleExecutableFileContent);
        expect(execSync(pathlib.join(dir.name, 'testexc'), { encoding: 'utf8' }).trim()).toEqual('1.2.3');

        expect(mockAxios.history.get[0].url).toEqual('http://example.com/testexc_version_1.2.3');

        fs.rmdirSync(dir.name, { recursive: true });
    });
});
