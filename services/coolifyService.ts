
export const triggerCoolifyDeployment = async (
    instanceUrl: string,
    apiToken: string,
    uuid: string,
    forceBuild: boolean
) => {
    if (!instanceUrl || !apiToken || !uuid) {
        throw new Error('Missing Coolify configuration');
    }

    const baseUrl = instanceUrl.replace(/\/$/, '');
    const params = new URLSearchParams();
    params.append('uuid', uuid);
    if (forceBuild) {
        params.append('force', 'true');
    }

    const url = `${baseUrl}/api/v1/deploy?${params.toString()}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiToken}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Deployment failed with status ${response.status}`);
    }

    return response.json();
};

export const getRecentDeployments = async (
    instanceUrl: string,
    apiToken: string,
    uuid: string
): Promise<any[]> => {
    if (!instanceUrl || !apiToken || !uuid) {
        throw new Error('Missing Coolify configuration');
    }

    const baseUrl = instanceUrl.replace(/\/$/, '');
    // Using application specific endpoint which returns { deployments: [...] }
    const url = `${baseUrl}/api/v1/deployments/applications/${uuid}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiToken}`
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Status check failed with status ${response.status}`);
    }

    const data = await response.json();
    // excessive safety check, but good to have
    const deployments = data.deployments && Array.isArray(data.deployments) ? data.deployments : [];

    // Return only the last 3 deployments
    return deployments.slice(0, 3);
};
