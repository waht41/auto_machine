import vscode from "vscode";
class MockUri implements vscode.Uri {
    static parse(value: string, strict?: boolean): MockUri {
        if (strict && (!value || value.length === 0)) {
            throw new Error('Uri is empty');
        }

        const match = /^(?:([^:/?#]+):)?(?:\/\/([^/?#]*))?([^?#]*)(?:\?([^#]*))?(?:#(.*))?/.exec(value);
        if (!match) {
            throw new Error('Invalid Uri');
        }

        return new MockUri(
            match[1] || '',
            match[2] || '',
            match[3] || '',
            match[4] || '',
            match[5] || ''
        );
    }

    static file(path: string): MockUri {
        path = path.replace(/\\/g, '/');
        return new MockUri('file', '', path, '', '');
    }

    static joinPath(base: MockUri, ...pathSegments: string[]): MockUri {
        if (!base.path) {
            throw new Error('Base uri must have a path');
        }

        const joinedPath = [base.path, ...pathSegments]
            .join('/')
            .replace(/\/+/g, '/')
            .replace(/\\/g, '/');

        return base.with({ path: joinedPath });
    }

    static from(components: {
        scheme: string;
        authority?: string;
        path?: string;
        query?: string;
        fragment?: string;
    }): MockUri {
        return new MockUri(
            components.scheme,
            components.authority || '',
            components.path || '',
            components.query || '',
            components.fragment || ''
        );
    }

    constructor(
        private _scheme: string,
        private _authority: string,
        private _path: string,
        private _query: string,
        private _fragment: string
    ) { }

    get scheme(): string { return this._scheme; }
    get authority(): string { return this._authority; }
    get path(): string { return this._path; }
    get query(): string { return this._query; }
    get fragment(): string { return this._fragment; }

    get fsPath(): string {
        let result = '';
        if (this._authority && this._scheme === 'file') {
            result += `//${this._authority}`;
        }
        
        if (process.platform === 'win32') {
            result += this._path.replace(/\//g, '\\');
        } else {
            result += this._path;
        }
        
        return result;
    }

    with(change: {
        scheme?: string;
        authority?: string;
        path?: string;
        query?: string;
        fragment?: string;
    }): MockUri {
        return new MockUri(
            change.scheme ?? this._scheme,
            change.authority ?? this._authority,
            change.path ?? this._path,
            change.query ?? this._query,
            change.fragment ?? this._fragment
        );
    }

    toString(skipEncoding: boolean = false): string {
        let result = '';

        if (this._scheme) {
            result += this._scheme;
            result += ':';
        }
        if (this._authority || this._scheme === 'file') {
            result += '//';
        }
        if (this._authority) {
            result += this._authority;
        }
        if (this._path) {
            let path = this._path;
            if (!skipEncoding) {
                path = encodeURIComponent(path).replace(/%2F/gi, '/');
            }
            result += path;
        }
        if (this._query) {
            let query = this._query;
            if (!skipEncoding) {
                query = encodeURIComponent(query);
            }
            result += '?' + query;
        }
        if (this._fragment) {
            let fragment = this._fragment;
            if (!skipEncoding) {
                fragment = encodeURIComponent(fragment);
            }
            result += '#' + fragment;
        }

        return result;
    }

    toJSON(): any {
        return {
            scheme: this.scheme,
            authority: this.authority,
            path: this.path,
            query: this.query,
            fragment: this.fragment,
        };
    }
}

export default MockUri;
