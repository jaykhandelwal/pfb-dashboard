
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
    // Using generic deployments endpoint with uuid query filter as the application-specific endpoint (path-based) returned 404
    const url = `${baseUrl}/api/v1/deployments?uuid=${uuid}&take=3`;

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

    const deployments = await response.json();
    return Array.isArray(deployments) ? deployments : [];
};
