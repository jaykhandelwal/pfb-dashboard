
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

    // Process deployments to extract version from logs
    const processedDeployments = deployments.map((deployment: any) => {
        let extractedVersion = null;
        if (deployment.logs) {
            try {
                // Logs are often a JSON string, try to parse it first if it looks like one
                let logContent = deployment.logs;
                // Simple regex to find the version pattern in the raw string or parsed content
                // Pattern: [Version] Generated version.ts: XX.XX.XX.XXXX
                // Improved regex to handle potential JSON escaping or slight format variations
                // Pattern: [Version] Generated version.ts: XX.XX.XX.XXXX
                // We use a broader match to catch it even if somewhat malformed in logs
                const versionMatch = /\[Version\] Generated version\.ts:\s*([0-9.]+)/.exec(logContent);
                if (versionMatch && versionMatch[1]) {
                    extractedVersion = versionMatch[1];
                }
            } catch (e) {
                // Ignore parsing errors
                console.warn('Failed to parse logs for version extraction', e);
            }
        }
        return {
            ...deployment,
            extracted_version: extractedVersion
        };
    });

    // Return only the last 3 deployments
    return processedDeployments.slice(0, 3);
};
