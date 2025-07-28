'use client';

import React, { useState, useEffect } from 'react';
import {
  SlaLevel,
  TicketPriority,
  TicketCategory
} from '@/generated/prisma';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CogIcon,
  ClockIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

interface CompanyRule {
  id: string;
  companyName: string;
  routingRules: {
    keywords?: string[];
    category?: string[];
    priority?: string[];
    requesterDomain?: string[];
  };
  assignedAgents: string[];
  priority: number;
  isActive: boolean;
}

interface SLAConfig {
  id: string;
  slaLevel: SlaLevel;
  priority: TicketPriority;
  firstResponseTime: number;
  resolutionTime: number;
  escalationTime: number;
  businessHoursOnly: boolean;
  isActive: boolean;
}

export function SupportSettings() {
  const [activeTab, setActiveTab] = useState<'company-rules' | 'sla-config'>('company-rules');
  const [companyRules, setCompanyRules] = useState<CompanyRule[]>([]);
  const [slaConfigs, setSlaConfigs] = useState<SLAConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompanyRuleModal, setShowCompanyRuleModal] = useState(false);
  const [showSLAModal, setShowSLAModal] = useState(false);
  const [editingRule, setEditingRule] = useState<CompanyRule | null>(null);
  const [editingSLA, setEditingSLA] = useState<SLAConfig | null>(null);

  // Company Rule Form State
  const [companyRuleForm, setCompanyRuleForm] = useState({
    companyName: '',
    keywords: [] as string[],
    category: [] as string[],
    priority: [] as string[],
    requesterDomain: [] as string[],
    assignedAgents: [] as string[],
    rulePriority: 1,
  });

  // SLA Config Form State
  const [slaForm, setSlaForm] = useState<{
    slaLevel: SlaLevel;
    priority: TicketPriority;
    firstResponseTime: number;
    resolutionTime: number;
    escalationTime: number;
    businessHoursOnly: boolean;
  }>({
    slaLevel: SlaLevel.STANDARD,
    priority: TicketPriority.MEDIUM,
    firstResponseTime: 60,
    resolutionTime: 480,
    escalationTime: 120,
    businessHoursOnly: false,
  });

  const [keywordInput, setKeywordInput] = useState('');
  const [domainInput, setDomainInput] = useState('');
  const [agentInput, setAgentInput] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesResponse, slaResponse] = await Promise.all([
        fetch('/api/support/company-rules'),
        fetch('/api/support/sla-config'),
      ]);

      if (rulesResponse.ok) {
        const rules = await rulesResponse.json();
        setCompanyRules(rules);
      }

      if (slaResponse.ok) {
        const slas = await slaResponse.json();
        setSlaConfigs(slas);
      }
    } catch (error) {
      console.error('Error fetching support settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCompanyRule = async () => {
    try {
      const response = await fetch('/api/support/company-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyRuleForm.companyName,
          routingRules: {
            keywords: companyRuleForm.keywords,
            category: companyRuleForm.category,
            priority: companyRuleForm.priority,
            requesterDomain: companyRuleForm.requesterDomain,
          },
          assignedAgents: companyRuleForm.assignedAgents,
          priority: companyRuleForm.rulePriority,
        }),
      });

      if (!response.ok) throw new Error('Failed to create company rule');

      setShowCompanyRuleModal(false);
      resetCompanyRuleForm();
      fetchData();
    } catch (error) {
      console.error('Error creating company rule:', error);
    }
  };

  const handleCreateSLAConfig = async () => {
    try {
      const response = await fetch('/api/support/sla-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slaForm),
      });

      if (!response.ok) throw new Error('Failed to create SLA config');

      setShowSLAModal(false);
      resetSLAForm();
      fetchData();
    } catch (error) {
      console.error('Error creating SLA config:', error);
    }
  };

  const resetCompanyRuleForm = () => {
    setCompanyRuleForm({
      companyName: '',
      keywords: [],
      category: [],
      priority: [],
      requesterDomain: [],
      assignedAgents: [],
      rulePriority: 1,
    });
    setKeywordInput('');
    setDomainInput('');
    setAgentInput('');
  };

  const resetSLAForm = () => {
    setSlaForm({
      slaLevel: SlaLevel.STANDARD,
      priority: TicketPriority.MEDIUM,
      firstResponseTime: 60,
      resolutionTime: 480,
      escalationTime: 120,
      businessHoursOnly: false,
    });
  };

  const addKeyword = () => {
    if (keywordInput.trim() && !companyRuleForm.keywords.includes(keywordInput.trim())) {
      setCompanyRuleForm(prev => ({
        ...prev,
        keywords: [...prev.keywords, keywordInput.trim()]
      }));
      setKeywordInput('');
    }
  };

  const addDomain = () => {
    if (domainInput.trim() && !companyRuleForm.requesterDomain.includes(domainInput.trim())) {
      setCompanyRuleForm(prev => ({
        ...prev,
        requesterDomain: [...prev.requesterDomain, domainInput.trim()]
      }));
      setDomainInput('');
    }
  };

  const addAgent = () => {
    if (agentInput.trim() && !companyRuleForm.assignedAgents.includes(agentInput.trim())) {
      setCompanyRuleForm(prev => ({
        ...prev,
        assignedAgents: [...prev.assignedAgents, agentInput.trim()]
      }));
      setAgentInput('');
    }
  };

  const removeItem = (array: string[], item: string, field: keyof typeof companyRuleForm) => {
    setCompanyRuleForm(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter(i => i !== item)
    }));
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Support Settings</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure automatic routing and escalation rules
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('company-rules')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'company-rules'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <UserGroupIcon className="h-5 w-5 inline mr-2" />
            Company Rules
          </button>
          <button
            onClick={() => setActiveTab('sla-config')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'sla-config'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <ClockIcon className="h-5 w-5 inline mr-2" />
            SLA Configuration
          </button>
        </nav>
      </div>

      {/* Company Rules Tab */}
      {activeTab === 'company-rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Company Routing Rules</h2>
            <Button onClick={() => setShowCompanyRuleModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>

          <div className="grid gap-4">
            {companyRules.map((rule) => (
              <Card key={rule.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {rule.companyName}
                      </h3>
                      <Badge className={rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      <Badge className="bg-blue-100 text-blue-800">
                        Priority: {rule.priority}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm text-gray-600">
                      {rule.routingRules.keywords && rule.routingRules.keywords.length > 0 && (
                        <div>
                          <span className="font-medium">Keywords:</span>{' '}
                          {rule.routingRules.keywords.join(', ')}
                        </div>
                      )}
                      {rule.routingRules.category && rule.routingRules.category.length > 0 && (
                        <div>
                          <span className="font-medium">Categories:</span>{' '}
                          {rule.routingRules.category.join(', ')}
                        </div>
                      )}
                      {rule.routingRules.requesterDomain && rule.routingRules.requesterDomain.length > 0 && (
                        <div>
                          <span className="font-medium">Domains:</span>{' '}
                          {rule.routingRules.requesterDomain.join(', ')}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Assigned Agents:</span>{' '}
                        {rule.assignedAgents.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {companyRules.length === 0 && (
            <Card className="p-8 text-center">
              <UserGroupIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No company rules configured
              </h3>
              <p className="text-gray-600 mb-4">
                Create routing rules to automatically assign tickets to specific agents based on company or criteria.
              </p>
              <Button onClick={() => setShowCompanyRuleModal(true)}>
                Create First Rule
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* SLA Configuration Tab */}
      {activeTab === 'sla-config' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">SLA Configuration</h2>
            <Button onClick={() => setShowSLAModal(true)}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add SLA Rule
            </Button>
          </div>

          <div className="grid gap-4">
            {slaConfigs.map((config) => (
              <Card key={config.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-medium text-gray-900">
                        {config.slaLevel} - {config.priority}
                      </h3>
                      <Badge className={config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {config.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                      {config.businessHoursOnly && (
                        <Badge className="bg-blue-100 text-blue-800">
                          Business Hours Only
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-gray-700">First Response:</span>
                        <div className="text-gray-900">{formatTime(config.firstResponseTime)}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Resolution:</span>
                        <div className="text-gray-900">{formatTime(config.resolutionTime)}</div>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700">Escalation:</span>
                        <div className="text-gray-900">{formatTime(config.escalationTime)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm">
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {slaConfigs.length === 0 && (
            <Card className="p-8 text-center">
              <ClockIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No SLA configurations found
              </h3>
              <p className="text-gray-600 mb-4">
                Configure SLA rules to define response and resolution times for different priority levels.
              </p>
              <Button onClick={() => setShowSLAModal(true)}>
                Create First SLA Rule
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Company Rule Modal */}
      <Modal isOpen={showCompanyRuleModal} onClose={() => setShowCompanyRuleModal(false)} size="lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Create Company Routing Rule
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Company Name *
              </label>
              <Input
                value={companyRuleForm.companyName}
                onChange={(e) => setCompanyRuleForm(prev => ({ ...prev, companyName: e.target.value }))}
                placeholder="Enter company name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keywords
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  placeholder="Add keyword"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  Add
                </Button>
              </div>
              {companyRuleForm.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {companyRuleForm.keywords.map((keyword) => (
                    <Badge key={keyword} className="bg-primary-100 text-primary-800">
                      {keyword}
                      <button
                        onClick={() => removeItem(companyRuleForm.keywords, keyword, 'keywords')}
                        className="ml-1 text-primary-600 hover:text-primary-800"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assigned Agents *
              </label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={agentInput}
                  onChange={(e) => setAgentInput(e.target.value)}
                  placeholder="Agent email or ID"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAgent())}
                />
                <Button type="button" variant="outline" onClick={addAgent}>
                  Add
                </Button>
              </div>
              {companyRuleForm.assignedAgents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {companyRuleForm.assignedAgents.map((agent) => (
                    <Badge key={agent} className="bg-green-100 text-green-800">
                      {agent}
                      <button
                        onClick={() => removeItem(companyRuleForm.assignedAgents, agent, 'assignedAgents')}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rule Priority
              </label>
              <Input
                type="number"
                min="1"
                value={companyRuleForm.rulePriority}
                onChange={(e) => setCompanyRuleForm(prev => ({ ...prev, rulePriority: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCompanyRuleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCompanyRule}>
              Create Rule
            </Button>
          </div>
        </div>
      </Modal>

      {/* SLA Config Modal */}
      <Modal isOpen={showSLAModal} onClose={() => setShowSLAModal(false)} size="lg">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            Create SLA Configuration
          </h2>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  SLA Level
                </label>
                <select
                  value={slaForm.slaLevel}
                  onChange={(e) => setSlaForm(prev => ({ ...prev, slaLevel: e.target.value as SlaLevel }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {Object.values(SlaLevel).map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  value={slaForm.priority}
                  onChange={(e) => setSlaForm(prev => ({ ...prev, priority: e.target.value as TicketPriority }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  {Object.values(TicketPriority).map(priority => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  First Response Time (minutes)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={slaForm.firstResponseTime}
                  onChange={(e) => setSlaForm(prev => ({ ...prev, firstResponseTime: parseInt(e.target.value) || 60 }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Time (minutes)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={slaForm.resolutionTime}
                  onChange={(e) => setSlaForm(prev => ({ ...prev, resolutionTime: parseInt(e.target.value) || 480 }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Escalation Time (minutes)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={slaForm.escalationTime}
                  onChange={(e) => setSlaForm(prev => ({ ...prev, escalationTime: parseInt(e.target.value) || 120 }))}
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={slaForm.businessHoursOnly}
                  onChange={(e) => setSlaForm(prev => ({ ...prev, businessHoursOnly: e.target.checked }))}
                />
                <span className="text-sm font-medium text-gray-700">
                  Business Hours Only
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowSLAModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSLAConfig}>
              Create SLA Rule
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}