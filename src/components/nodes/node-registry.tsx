'use client';

/**
 * @fileoverview Node registry browser component.
 */

import * as React from "react";
import { useState } from "react";
import { NodeRegistry, NodeRegistryMetadata } from "agentdock-core";
import { NodeMetadata, NodePort } from "agentdock-core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Settings2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NodeConfigForm } from "./node-config-form";
import { ErrorBoundary } from "@/components/error-boundary";
import { ErrorInfo } from "react";

interface NodeRegistryItemProps {
  type: string;
  metadata: NodeMetadata;
}

/**
 * Node registry browser component
 */
function BaseNodeRegistryBrowser() {
  const metadata = NodeRegistry.getNodeMetadata();
  const [selectedNode, setSelectedNode] = useState<NodeRegistryItemProps | null>(null);

  const renderNodeInputs = (inputs: readonly NodePort[]) => (
    inputs.map((input) => (
      <Badge
        key={input.id}
        variant="outline"
        className="mr-1"
      >
        {input.label}
        {input.required && (
          <span className="text-red-500 ml-1">*</span>
        )}
      </Badge>
    ))
  );

  const renderNodeOutputs = (outputs: readonly NodePort[]) => (
    outputs.map((output) => (
      <Badge
        key={output.id}
        variant="outline"
        className="mr-1"
      >
        {output.label}
      </Badge>
    ))
  );

  const handleConfigureNode = (node: NodeRegistryItemProps) => {
    setSelectedNode(node);
  };

  const handleConfigSubmit = (config: Record<string, unknown>) => {
    if (!selectedNode) return;
    
    // TODO: Add node to agent with configuration
    console.log('Configuring node:', selectedNode.type, config);
    setSelectedNode(null);
  };

  const renderNodeRow = (node: NodeRegistryItemProps) => (
    <TableRow key={node.type}>
      <TableCell className="font-medium">
        {node.metadata.label}
        <Badge className="ml-2" variant="secondary">
          {node.type}
        </Badge>
      </TableCell>
      <TableCell>{node.metadata.description}</TableCell>
      <TableCell>
        {renderNodeInputs(node.metadata.inputs)}
      </TableCell>
      <TableCell>
        {renderNodeOutputs(node.metadata.outputs)}
      </TableCell>
      <TableCell className="text-right">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleConfigureNode(node)}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Node</DialogTitle>
              <DialogDescription>
                Configure the node settings before adding it to the agent.
              </DialogDescription>
            </DialogHeader>
            {selectedNode && (
              <NodeConfigForm
                nodeType={selectedNode.type}
                metadata={selectedNode.metadata}
                onSubmit={handleConfigSubmit}
              />
            )}
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Node Registry</CardTitle>
        <CardDescription>
          Browse and configure available nodes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Core Nodes */}
          <div>
            <h3 className="text-lg font-medium">Core Nodes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Built-in nodes provided by the framework
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Inputs</TableHead>
                  <TableHead>Outputs</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metadata.nodes.map(renderNodeRow)}
              </TableBody>
            </Table>
          </div>

          {/* Custom Nodes */}
          <div>
            <h3 className="text-lg font-medium">Custom Nodes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              User-defined nodes for custom functionality
            </p>
            {metadata.customNodes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No custom nodes registered
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Inputs</TableHead>
                    <TableHead>Outputs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metadata.customNodes.map(renderNodeRow)}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button className="ml-auto">
          <Plus className="mr-2 h-4 w-4" />
          Create Custom Node
        </Button>
      </CardFooter>
    </Card>
  );
}

export function NodeRegistryBrowser() {
  return (
    <ErrorBoundary
      onError={(error: Error, errorInfo: ErrorInfo) => {
        console.error("Error in NodeRegistryBrowser:", error, errorInfo);
      }}
      resetOnPropsChange
    >
      <BaseNodeRegistryBrowser />
    </ErrorBoundary>
  );
} 