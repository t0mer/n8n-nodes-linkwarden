import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class LinkwardenApi implements ICredentialType {
	name = 'linkwardenApi';

	displayName = 'Linkwarden API';

	icon: Icon = { light: 'file:linkwarden.svg', dark: 'file:linkwarden.dark.svg' };

	documentationUrl = 'https://github.com/t0mer/n8n-nodes-linkwarden?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://cloud.linkwarden.app',
			required: true,
			placeholder: 'https://links.example.com',
			description: 'Your Linkwarden URL, e.g. https://links.example.com',
		},
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Create one in Linkwarden under Settings → Access Tokens',
		},
		{
			displayName: 'Ignore SSL Issues (Insecure)',
			name: 'ignoreSslIssues',
			type: 'boolean',
			default: false,
			description:
				'Whether to connect even if SSL certificate validation fails, e.g. for a self-signed certificate on a home-lab instance',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.accessToken}}',
			},
			skipSslCertificateValidation: '={{$credentials.ignoreSslIssues}}',
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/api/v1/users/me',
			method: 'GET',
			skipSslCertificateValidation: '={{$credentials.ignoreSslIssues}}',
		},
	};
}
