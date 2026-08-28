async function fromProviderA(ipAddress) {
  const mode = process.env.GEO_PROVIDER_A_MODE || 'real';

  if (mode === 'fail') {
    throw new Error('Provider A forced down');
  }

  if (mode === 'success') {
    return {
      country: 'Pakistan',
      city: 'Lahore',
      geo_provider: 'provider_a'
    };
  }

  const response = await fetch(`http://ip-api.com/json/${encodeURIComponent(ipAddress)}`);
  if (!response.ok) {
    throw new Error(`Provider A HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.status !== 'success') {
    throw new Error(body.message || 'Provider A returned no match');
  }

  return {
    country: body.country || null,
    city: body.city || null,
    geo_provider: 'provider_a'
  };
}

async function fromProviderB(ipAddress) {
  const mode = process.env.GEO_PROVIDER_B_MODE || 'real';

  if (mode === 'fail') {
    throw new Error('Provider B forced down');
  }

  if (mode === 'success') {
    return {
      country: 'United States',
      city: 'New York',
      geo_provider: 'provider_b'
    };
  }

  const response = await fetch(`https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`);
  if (!response.ok) {
    throw new Error(`Provider B HTTP ${response.status}`);
  }

  const body = await response.json();
  if (body.error) {
    throw new Error(body.reason || 'Provider B returned no match');
  }

  return {
    country: body.country_name || null,
    city: body.city || null,
    geo_provider: 'provider_b'
  };
}

async function lookup(ipAddress) {
  if (!ipAddress) {
    return {
      country: null,
      city: null,
      geo_provider: null
    };
  }

  for (const provider of [fromProviderA, fromProviderB]) {
    try {
      return await provider(ipAddress);
    } catch (error) {
      console.warn('Geo provider failed', {
        provider: provider.name,
        message: error.message
      });
    }
  }

  return {
    country: null,
    city: null,
    geo_provider: null
  };
}

module.exports = {
  lookup
};

