package main

// TraefikConfig represents the structure of dynamic.yml
type TraefikConfig struct {
	HTTP HTTPConfig `yaml:"http" json:"http"`
}

type HTTPConfig struct {
	Routers     map[string]Router     `yaml:"routers" json:"routers"`
	Services    map[string]Service    `yaml:"services" json:"services"`
	Middlewares map[string]Middleware `yaml:"middlewares,omitempty" json:"middlewares,omitempty"`
}

type Router struct {
	Rule        string   `yaml:"rule" json:"rule"`
	EntryPoints []string `yaml:"entryPoints" json:"entryPoints"`
	Service     string   `yaml:"service" json:"service"`
	Middlewares []string `yaml:"middlewares,omitempty" json:"middlewares,omitempty"`
	TLS         *TLS     `yaml:"tls,omitempty" json:"tls,omitempty"`
}

type TLS struct {
	CertResolver string `yaml:"certResolver,omitempty" json:"certResolver,omitempty"`
}

type Service struct {
	LoadBalancer LoadBalancer `yaml:"loadBalancer" json:"loadBalancer"`
}

type LoadBalancer struct {
	Servers []Server `yaml:"servers" json:"servers"`
}

type Server struct {
	URL string `yaml:"url" json:"url"`
}

type Middleware struct {
	Name        string `yaml:"name" json:"name"`
	Type        string `yaml:"type" json:"type"`
	Description string `yaml:"description,omitempty" json:"description,omitempty"`
	Status      string `yaml:"status,omitempty" json:"status,omitempty"`
	Provider    string `yaml:"provider,omitempty" json:"provider,omitempty"`
}
