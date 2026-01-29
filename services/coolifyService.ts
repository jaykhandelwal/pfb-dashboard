
export const triggerCoolifyDeployment = async (
    instanceUrl: string,
    apiToken: string,
    tagOrUuid: string,
    targetType: 'tag' | 'uuid',
    forceBuild: boolean
) => {
    if (!instanceUrl || !apiToken || !tagOrUuid) {
        throw new Error('Missing Coolify configuration');
    }

    const baseUrl = instanceUrl.replace(/\/$/, '');
    const params = new URLSearchParams();
    params.append(targetType, tagOrUuid);
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
