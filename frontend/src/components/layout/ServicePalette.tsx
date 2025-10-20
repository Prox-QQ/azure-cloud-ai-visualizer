import { useState } from 'react';
import { Icon } from '@iconify/react';
import { azureServices, serviceCategories } from '@/data/azureServices';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ServicePalette = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    const filteredServices = azureServices.filter((service) => {
    const title = (service.title || '').toLowerCase();
    const desc = (service.description || '').toLowerCase();
    const matchesSearch = title.includes(search.toLowerCase()) || desc.includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || service.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const onDragStart = (event: React.DragEvent, service: typeof azureServices[0]) => {
    event.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: 'azure.service',
        data: {
          title: service.title,
          iconPath: service.iconPath,
          status: 'inactive',
          category: service.category,
        },
      }),
    );
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <aside className="glass-panel border-r border-border/50 w-64 flex flex-col">
      <div className="p-4 border-b border-border/50">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Icon icon="mdi:view-grid-plus" className="text-primary" />
          Service Palette
        </h2>
        <Input
          type="text"
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-muted/30"
        />
      </div>

      <div className="p-2 border-b border-border/50">
        {/* Use a non-empty sentinel value for the "All" option because Radix Select
            does not allow an Item with an empty string value. We map the sentinel
            to null in state so filtering behavior remains the same. */}
        <Select
          value={selectedCategory ?? '__all__'}
          onValueChange={(v) => setSelectedCategory(v === '__all__' ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {serviceCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredServices.map((service) => (
          <div
            key={service.id}
            draggable
            onDragStart={(e) => onDragStart(e, service)}
            className="glass-hover p-3 rounded-lg cursor-move flex items-center gap-3 group"
          >
            <div className="p-2 rounded bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <img
                src={service.iconPath}
                alt={service.title}
                className="h-6 w-6 object-contain"
                draggable={false}
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium truncate">{service.title}</h3>
              <p className="text-xs text-muted-foreground truncate">{service.description}</p>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default ServicePalette;
